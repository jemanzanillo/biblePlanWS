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
  res.send('El bot está vivo. Ve a /qr para escanear.');
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

app.listen(port, () => {
  console.log(`Servidor web listo en puerto ${port}`);
});



// 1. Configuración del cliente
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
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

// Programar envío: Todos los días a las 8:00 AM hora servidor
    // Nota: Render usa hora UTC (Londres). 8:00 AM UTC son las 4:00 AM en Rep. Dom.
    // Si quieres que sea a las 8 AM RD, pon '0 12 * * *' (12:00 UTC)
    cron.schedule('0 10 * * *', () => { 
        enviarLecturaDiaria();
    });
});

async function enviarLecturaDiaria() {
    try {
        const data = JSON.parse(fs.readFileSync('./lecturas.json', 'utf8'));

// --- FECHA DE HOY ---
        const hoy = new Date();
        const diaHoy = String(hoy.getDate()).padStart(2, '0');
        const mesHoy = String(hoy.getMonth() + 1).padStart(2, '0');
        const claveHoy = `${diaHoy}-${mesHoy}`;

// --- FECHA DE MAÑANA ---
        const manana = new Date(hoy);
        manana.setDate(manana.getDate() + 1); // Sumar 1 día
        const diaManana = String(manana.getDate()).padStart(2, '0');
        const mesManana = String(manana.getMonth() + 1).padStart(2, '0');
        const claveManana = `${diaManana}-${mesManana}`;

        // Obtener lecturas
        const lecturaHoy = data[claveHoy] || "No hay lectura programada";
        const lecturaManana = data[claveManana] || "No hay lectura programada";

        if (data[claveHoy]) {
            // Construimos el mensaje con ambas fechas
            const mensaje = `📖 *Lectura Bíblica Diaria*\n\n` +
                            `📅 *Hoy (${claveHoy}):* ${lecturaHoy}\n` +
                            `🔜 *Mañana (${claveManana}):* ${lecturaManana}\n\n` +
                            `_¡Que tengas un bendecido día!_`;
        
            // --- LISTA DE NÚMEROS A ENVIAR (SEGURO) ---
            // Ahora leemos desde las variables de entorno
            const destinatarios = [
                process.env.NUMERO_UNO,
                process.env.NUMERO_DOS
            ];
            const validos = destinatarios.filter(n => n);

            for (const numero of validos) {
                await client.sendMessage(numero, mensaje);
                console.log(`Enviado a ${numero}`);
                await new Promise(r => setTimeout(r, 2000));
            }
        }
    } catch (error) {
        console.error('Error enviando:', error);
    }
}

client.initialize();