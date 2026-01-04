# 📖 Bible Plan WhatsApp Bot

Un bot automatizado de WhatsApp diseñado para enviar diariamente la porción de lectura bíblica correspondiente a un plan anual. Construido con Node.js y la librería `whatsapp-web.js`.

El bot es capaz de funcionar tanto en la nube (Deploy en Render) como en modo local (PC), y soporta múltiples destinatarios.

## 🚀 Características

* **📅 Envío Automático:** Programado para enviar mensajes diariamente a una hora específica.
* **👥 Multi-destinatario:** Envía el plan de lectura a múltiples números configurados.
* **☁️ Cloud Ready:** Optimizado para despliegue gratuito en Render usando Docker y Puppeteer.
* **📱 Escaneo Web:** Genera una página web (`/qr`) para escanear el código QR fácilmente desde la nube.
* **💻 Modo Respaldo:** Incluye un script para ejecución local ligera en caso de fallos del servidor.
* **🔒 Seguro:** Manejo de números telefónicos mediante variables de entorno (`.env`).

## 🛠️ Tecnologías

* [Node.js](https://nodejs.org/)
* [whatsapp-web.js](https://wwebjs.dev/) - Cliente de WhatsApp.
* [Express](https://expressjs.com/) - Servidor web para mantener vivo el servicio en Render.
* [Puppeteer](https://pptr.dev/) - Navegador Headless para la automatización.
* [node-cron](https://www.npmjs.com/package/node-cron) - Programador de tareas.

## 📋 Requisitos Previos

* Node.js v18 o superior.
* Una cuenta de WhatsApp (se recomienda un número secundario, aunque funciona con el personal).
* Git.

## ⚙️ Instalación y Configuración

1.  **Clonar el repositorio:**
    ```bash
    git clone [https://github.com/jemanzanillo/biblePlanWS.git](https://github.com/jemanzanillo/biblePlanWS.git)
    cd biblePlanWS
    ```

2.  **Instalar dependencias:**
    ```bash
    npm install
    ```

3.  **Configurar Variables de Entorno:**
    Crea un archivo `.env` en la raíz del proyecto (este archivo **NO** debe subirse a GitHub) y agrega tus números:
    ```env
    PORT=3000
    NUMERO_UNO=1809xxxxxxx@c.us
    NUMERO_DOS=1829xxxxxxx@c.us
    ```
    *Nota: El formato del número debe incluir el código de país y terminar en `@c.us`.*

## 🏃‍♂️ Ejecución

### Opción A: Modo Nube (Render / Servidor)
Este modo levanta un servidor Express y está optimizado para Docker.

1.  Ejecuta el comando:
    ```bash
    node index.js
    ```
2.  Abre tu navegador en `http://localhost:3000/qr` para escanear el código.

### Opción B: Modo Local (Respaldo en PC)
Este modo es ligero y muestra el QR directamente en la terminal. Ideal si el servidor falla.

1.  Ejecuta el comando:
    ```bash
    node local.js
    ```
2.  Escanea el código QR que aparecerá en la terminal.

## ☁️ Despliegue en Render

Este proyecto incluye un `Dockerfile` configurado para Render.

1.  Crea un nuevo **Web Service** en Render conectado a este repositorio.
2.  Selecciona el entorno **Docker**.
3.  En la sección "Environment Variables", agrega las claves `NUMERO_UNO` y `NUMERO_DOS` con sus respectivos valores.
4.  Una vez desplegado, entra a la URL de tu servicio agregando `/qr` al final (ej: `https://mi-bot.onrender.com/qr`) para vincular WhatsApp.

## 📂 Estructura de Archivos Relevantes

* `index.js`: Punto de entrada para el servidor (Nube).
* `local.js`: Punto de entrada para ejecución local (PC).
* `lecturas.json`: Base de datos con el plan de lectura (Fecha: Pasaje).
* `Dockerfile`: Configuración para instalar Chrome y dependencias en Linux.

## ⚠️ Nota Legal

Este proyecto no está afiliado, asociado, autorizado, respaldado ni conectado oficialmente de ninguna manera con WhatsApp o Meta. Es un proyecto educativo y de uso personal.

---
Hecho con ❤️ para el estudio de la Palabra.
