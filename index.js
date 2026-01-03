const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const cron = require('node-cron');
const express = require('express');

// --- CONFIGURACIÓN PARA RENDER (SERVIDOR WEB) ---
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('El bot está vivo y corriendo.');
});

app.listen(port, () => {
  console.log(`Servidor web escuchando en el puerto ${port}`);
});
//



// 1. Configuración del cliente
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        // Estos argumentos son OBLIGATORIOS para correr en Render/Linux
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    // En la nube no podemos ver la terminal tan fácil, así que imprimimos el QR en texto
    console.log('QR RECIBIDO (Mira los logs de Render para escanearlo):', qr);
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('¡Bot conectado con éxito!');

// Programar envío: Todos los días a las 8:00 AM hora servidor
    // Nota: Render usa hora UTC (Londres). 8:00 AM UTC son las 4:00 AM en Rep. Dom.
    // Si quieres que sea a las 8 AM RD, pon '0 12 * * *' (12:00 UTC)
    cron.schedule('0 12 * * *', () => { 
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
        
        // --- LISTA DE NÚMEROS A ENVIAR ---
            // Agrega aquí los dos números con el formato correcto (código país + número + @c.us)
            const destinatarios = [
                '14234649896@c.us', // Engel
                // '18299415959@c.us'  // Franchesca
            ];
        
        for (const numero of destinatarios) {
                        await client.sendMessage(numero, mensaje);
                        console.log(`Mensaje enviado a ${numero}`);
                        // Esperamos 2 segundos entre mensajes para que WhatsApp no lo detecte como spam rápido
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }
            } catch (error) {
                console.error('Error enviando mensaje:', error);
            }
        }

client.initialize();