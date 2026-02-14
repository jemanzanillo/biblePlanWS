require('dotenv').config();
const { 
    makeWASocket, 
    DisconnectReason, 
    BufferJSON, 
    initAuthCreds, 
    fetchLatestBaileysVersion 
} = require('@whiskeysockets/baileys');
const mongoose = require('mongoose');
const pino = require('pino');
const fs = require('fs');
const cron = require('node-cron');
const express = require('express');
const qrcode = require('qrcode');


// --- CONFIGURACIÓN PARA RENDER (SERVIDOR WEB) ---
const app = express();
const port = process.env.PORT || 3000;

// Variable global para guardar el QR actual
let qrCodeImage = null;
let sock = null; // Aquí guardaremos la conexión

// --- CONFIGURACIÓN MONGODB ---
// Definimos el esquema para guardar credenciales y claves (keys)
const AuthSchema = new mongoose.Schema({
    _id: String, // ID único para cada clave o 'creds'
    data: String // Datos serializados con BufferJSON
}, { timestamps: true });

const AuthModel = mongoose.model('Auth', AuthSchema);

// --- ADAPTADOR DE SESIÓN MONGODB ---
// Este adaptador reemplaza a useMultiFileAuthState para usar la base de datos
async function useMongoDBAuthState() {
    const readData = async (id) => {
        try {
            const res = await AuthModel.findById(id);
            if (!res) return null;
            return JSON.parse(res.data, BufferJSON.reviver);
        } catch (error) {
            return null;
        }
    };

    const writeData = async (id, data) => {
        const str = JSON.stringify(data, BufferJSON.replacer);
        await AuthModel.findByIdAndUpdate(id, { data: str }, { upsert: true });
    };

    const removeData = async (id) => {
        await AuthModel.findByIdAndDelete(id);
    };

    // Inicializar credenciales o leer las existentes
    let creds = await readData('creds');
    if (!creds) {
        creds = initAuthCreds();
        await writeData('creds', creds);
    }

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async (id) => {
                        let value = await readData(`${type}-${id}`);
                        if (type === 'app-state-sync-key' && value) {
                            // Corrección interna para Baileys
                            value = value; 
                        }
                        data[id] = value;
                    }));
                    return data;
                },
                set: async (data) => {
                    for (const category of Object.keys(data)) {
                        for (const id of Object.keys(data[category])) {
                            const value = data[category][id];
                            const key = `${category}-${id}`;
                            if (value) {
                                await writeData(key, value);
                            } else {
                                await removeData(key);
                            }
                        }
                    }
                }
            }
        },
        saveCreds: async () => {
            await writeData('creds', creds);
        }
    };
}

// --- SERVIDOR WEB ---
app.get('/', (req, res) => {
    const ahora = new Date().toLocaleString("en-US", {timeZone: "America/Santo_Domingo"});
    res.send(`Bot Baileys (MongoDB) Activo. Hora RD: ${ahora}. <br> <a href="/qr">Ver QR</a> <br> <a href="/forzar-envio">Forzar Envío</a>`);
});

// Ruta especial para ver el QR en el navegador
app.get('/qr', async (req, res) => {
    if (qrCodeImage) {
        // Muestra el QR como una imagen HTML
        res.send(`<html><meta http-equiv="refresh" content="5"><body><div style="text-align:center;"><h1>Escanea con WhatsApp</h1><img src="${qrCodeImage}" /><p>Refrescando cada 5s...</p></div></body></html>`);
    } else {
        res.send('<h1>⏳ No hay QR pendiente (o ya estás conectado).</h1>');
    }
});

app.get('/forzar-envio', async (req, res) => {
    console.log('⚠️ Envío manual solicitado');
    await enviarLecturaDiaria();
    res.send('✅ Envío iniciado.');
});

app.listen(port, () => {
    console.log(`Servidor web listo en puerto ${port}`);
});



// --- LÓGICA DE CONEXIÓN WHATSAPP ---
async function connectToWhatsApp() {
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Base de datos MongoDB lista');
    }

    const { state, saveCreds } = await useMongoDBAuthState();
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true, // Imprime en logs también
        logger: pino({ level: 'silent' }), // Evita llenar los logs de basura
        browser: ["BibleBot Cloud", "Chrome", "1.0"],
        // AJUSTE: Ignora mensajes antiguos y sincronización pesada de historial
        shouldSyncHistoryMessage: () => false, 
        markOnlineOnConnect: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            // Generar imagen QR para la web
            qrcode.toDataURL(qr, (err, url) => {
                qrCodeImage = url;
                console.log('⚡ Nuevo QR generado');
            });
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            // Si la razón es que se cerró la sesión en el celular, no reintentes
            const debeReconectar = reason !== DisconnectReason.loggedOut;
            
            qrCodeImage = null;
            console.log(`Conexión cerrada: ${reason}. Reconectando: ${debeReconectar}`);
            
            if (debeReconectar) {
            // Espera 5 segundos antes de reintentar para evitar loops
            // Esto evita los loops infinitos y errores de Bad MAC
            setTimeout(() => connectToWhatsApp(), 5000);
            }
        } else if (connection === 'open') {
            console.log('✅ ¡CONECTADO EXITOSAMENTE A WHATSAPP! con MongoDB');
            qrCodeImage = null;
        }
    });
}

// --- PROGRAMACIÓN ---
// Cron a las 10:05 UTC (6:05 AM RD)
cron.schedule('5 10 * * *', () => { 
    console.log('⏰ Cron disparado.');
    enviarLecturaDiaria();
}, { timezone: "UTC" });

// let estaEnviando = false; // El cerrojo

// --- FUNCIÓN DE ENVÍO ---
async function enviarLecturaDiaria() {
    // NUEVA VALIDACIÓN: Si sock existe y tiene un usuario, está conectado.
    if (!sock || !sock.user) {
        console.error('❌ Intento de envío fallido: El bot aún no tiene un usuario vinculado.');
        return;
    }

    try {
        const data = JSON.parse(fs.readFileSync('./lecturas.json', 'utf8'));

        // Configuración de fecha
        const options = { timeZone: 'America/Santo_Domingo', year: 'numeric', month: '2-digit', day: '2-digit' };
        const formatter = new Intl.DateTimeFormat('en-CA', options);
        const [year, month, day] = formatter.format(new Date()).split('-');
        const claveHoy = `${day}-${month}`;

        // Fecha mañana
        const fechaManana = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Santo_Domingo"}));
        fechaManana.setDate(fechaManana.getDate() + 1);
        const diaManana = String(fechaManana.getDate()).padStart(2, '0');
        const mesManana = String(fechaManana.getMonth() + 1).padStart(2, '0');
        const claveManana = `${diaManana}-${mesManana}`;

        const lecturaHoy = data[claveHoy];
        const lecturaManana = data[claveManana] || "Por definir";

        if (data[claveHoy]) {
            const mensaje = `📖 *Lectura Bíblica Diaria (R)*\n\n` +
                            `📅 *Hoy (${claveHoy}):* ${lecturaHoy}\n` +
                            `🔜 *Mañana (${claveManana}):* ${lecturaManana}\n\n` +
                            `_¡Bendiciones!_`;

            // OJO: En Baileys los números llevan el sufijo @s.whatsapp.net
            // Asegúrate que tus variables de entorno NO tengan el @c.us o @s.whatsapp.net, solo el número
            // O limpia el número aquí:
            const numeros = [process.env.NUMERO_UNO, process.env.NUMERO_DOS];

            for (let num of numeros) {
                if(!num) continue;
                // Limpieza del número para formato Baileys
                const idLimpio = num.replace('@c.us', '').replace('@s.whatsapp.net', '').replace('+', '') + '@s.whatsapp.net';
                
                // VALIDACIÓN EXTRA: Verificar si el socket está abierto antes de enviar cada mensaje
                console.log(`Enviando a ${idLimpio}...`);
                await sock.sendMessage(idLimpio, { text: mensaje });
                console.log(`✅ Enviado a ${idLimpio}`);
                await new Promise(r => setTimeout(r, 2000));
            }
            console.log('✅ Envíos terminados');
        } else {
            console.log('No hay lectura para hoy');
        }
    } catch (e) {
        console.error('Error enviando:', e);
    }
}

// Iniciar

connectToWhatsApp();

