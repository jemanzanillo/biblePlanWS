require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const cron = require('node-cron');
const express = require('express');
const qrcode = require('qrcode'); // Librería nueva para web



// --- CONFIGURACIÓN PARA RENDER (SERVIDOR WEB) ---
const app = express();
const port = process.env.PORT || 3000;

// Variable global para guardar el QR actual
let qrCodeImage = null;

// --- SERVIDOR WEB ---
app.get('/', (req, res) => {
    const ahora = new Date().toLocaleString("en-US", {timeZone: "America/Santo_Domingo"});
    res.send(`El bot está despierto. Hora servidor (RD): ${ahora}. Ve a /qr para escanear.`);
});

// Ruta especial para ver el QR en el navegador
app.get('/qr', async (req, res) => {
    if (qrCodeImage) {
        // Muestra el QR como una imagen HTML
        res.send(`
            <html>
                <head><meta http-equiv="refresh" content="20"></head> <body style="display:flex; justify-content:center; align-items:center; height:100vh; background:#f0f0f0;">
                    <div style="text-align:center;">
                        <h1>Escanea con WhatsApp</h1>
                        <img src="${qrCodeImage}" style="border:10px solid white; box-shadow: 0 4px 8px rgba(0,0,0,0.1);" />
                        <p>Si cambia, la página se recargará sola.</p>
                    </div>
                </body>
            </html>
        `);
    } else {
        res.send('<h1>⏳ Esperando código QR... o ya está conectado.</h1>');
    }
});

app.get('/forzar-envio', async (req, res) => {
    console.log('⚠️ Se solicitó envío manual vía web');
    await enviarLecturaDiaria();
    res.send('✅ Proceso de envío iniciado manualmente. Revisa WhatsApp.');
});

app.listen(port, () => {
  console.log(`Servidor web listo en puerto ${port}`);
});



// 1. Configuración del cliente
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

client.on('qr', (qr) => {
    // Convertimos el código de texto a una imagen Data URL para mostrar en la web
    qrcode.toDataURL(qr, (err, url) => {
        if (err) {
            console.error('Error generando QR web', err);
            return;
        }
        qrCodeImage = url; // Guardamos la imagen
        console.log('Nuevo QR generado. Abre tu web en /qr para verlo.');
    });
});

client.on('ready', () => {
    console.log('¡Bot conectado con éxito!');
    qrCodeImage = null; // Borramos el QR porque ya no hace falta

// --- PROGRAMACIÓN ---
    // 6:00 AM hora RD es 10:00 AM UTC.
    // Cron usa hora del servidor (UTC en Render).
    // Configurado para: 10:00 UTC (Minuto 0, Hora 12)
    cron.schedule('0 10 * * *', () => { 
        console.log('⏰ Cron disparado: Iniciando envío diario...');
        enviarLecturaDiaria();
    }, {
        timezone: "UTC" // Aseguramos que el cron sepa que estamos usando UTC
    });
});

async function enviarLecturaDiaria() {
    try {
        const data = JSON.parse(fs.readFileSync('./lecturas.json', 'utf8'));

        // Ajustamos la fecha para que coincida con RD
        // Usamos Intl.DateTimeFormat para obtener la fecha correcta en tu zona
        const options = { timeZone: 'America/Santo_Domingo', year: 'numeric', month: '2-digit', day: '2-digit' };
        const formatter = new Intl.DateTimeFormat('en-CA', options); // formato YYYY-MM-DD
        const [year, month, day] = formatter.format(new Date()).split('-');
const claveHoy = `${day}-${month}`;
        
        // Para mañana, sumamos 1 día a la fecha actual
        const fechaManana = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Santo_Domingo"}));
        fechaManana.setDate(fechaManana.getDate() + 1);
        const diaManana = String(fechaManana.getDate()).padStart(2, '0');
        const mesManana = String(fechaManana.getMonth() + 1).padStart(2, '0');
        const claveManana = `${diaManana}-${mesManana}`;

        console.log(`📅 Buscando lectura para hoy: ${claveHoy} y mañana: ${claveManana}`);

        const lecturaHoy = data[claveHoy];
        const lecturaManana = data[claveManana] || "Por definir";

        if (lecturaHoy) {
            const mensaje = `📖 *Lectura Bíblica Diaria*\n\n` +
                            `📅 *Hoy (${claveHoy}):* ${lecturaHoy}\n` +
                            `🔜 *Mañana (${claveManana}):* ${lecturaManana}\n\n` +
                            `_¡Ten un buen día!_`;

            const destinatarios = [
                process.env.NUMERO_UNO,
                process.env.NUMERO_DOS
            ];
            
            const validos = destinatarios.filter(n => n);

            for (const numero of validos) {
                console.log(`Enviando a: ${numero}...`);
                await client.sendMessage(numero, mensaje);
                await new Promise(r => setTimeout(r, 2000));
            }
            console.log('✅ Envío finalizado.');
        } else {
            console.log('❌ No hay lectura programada para hoy en el JSON.');
        }
    } catch (error) {
        console.error('❌ Error enviando:', error);
    }
}

client.initialize();