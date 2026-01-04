require('dotenv').config();
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
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
let sock; // Aquí guardaremos la conexión

// --- SERVIDOR WEB ---
app.get('/', (req, res) => {
    const ahora = new Date().toLocaleString("en-US", {timeZone: "America/Santo_Domingo"});
    res.send(`Bot Baileys Activo. Hora RD: ${ahora}. <br> <a href="/qr">Ver QR</a> <br> <a href="/forzar-envio">Forzar Envío</a>`);
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
    // Usamos una carpeta local 'auth_info' para guardar la sesión
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true, // Imprime en logs también
        logger: pino({ level: 'silent' }), // Evita llenar los logs de basura
        browser: ["BibleBot", "Chrome", "1.0"]
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
            qrCodeImage = null;
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexión cerrada. ¿Reconectar?: ', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp(); // Bucle de reconexión
            }
        } else if (connection === 'open') {
            console.log('✅ ¡CONECTADO EXITOSAMENTE A WHATSAPP!');
            qrCodeImage = null;
        }
    });
}

// --- PROGRAMACIÓN ---
// Cron a las 10:00 UTC (6 AM RD)
cron.schedule('5 10 * * *', () => { 
    console.log('⏰ Cron disparado.');
    enviarLecturaDiaria();
}, { timezone: "UTC" });

// --- FUNCIÓN DE ENVÍO ---
async function enviarLecturaDiaria() {
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

        if (lecturaHoy) {
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
                
                console.log(`Enviando a ${idLimpio}...`);
                await sock.sendMessage(idLimpio, { text: mensaje });
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