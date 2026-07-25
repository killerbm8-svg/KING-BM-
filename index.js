const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const QRCode = require('qrcode');

const app = express();
const port = process.env.PORT || 3000;

let currentQrImageUrl = "";
let livePairingCode = "No text code generated yet. Request one below.";
let botStatus = "Disconnected";
let globalSock = null;

// HTML Unified Dual-Authentication Dashboard (Simplified)
function getHtmlDashboard(qrImageUrl, textCode, status) {
    let qrBox = qrImageUrl ? `<img src="${qrImageUrl}" alt="Scan QR" style="width:200px; height:200px;"/>` : `<div style="padding: 60px 10px;">Generating QR...</div>`;
    let statusBadge = status === "Connected" ? `<span style="color:green">CONNECTED 🎉</span>` : `<span style="color:red">${status.toUpperCase()}</span>`;

    return `
    <!DOCTYPE html>
    <html>
    <head><title>KING-BM Linker</title><style>body{font-family:sans-serif; background:#0f172a; color:#fff; text-align:center; padding:20px;}</style></head>
    <body>
        <h1>👑 KING-BM CONTROLLER</h1>
        <div>Status: ${statusBadge}</div>
        <div style="display:flex; justify-content:center; gap:20px; margin-top:20px;">
            <div style="background:#1e293b; padding:20px; border-radius:12px;">
                <h3>Scan QR Code</h3>
                <div style="background:white; padding:10px;">${qrBox}</div>
            </div>
            <div style="background:#1e293b; padding:20px; border-radius:12px;">
                <h3>Text Pairing Code</h3>
                <div style="font-size:20px; color:#22c55e;">${textCode}</div>
                <form action="/get-text-code" method="GET">
                    <input type="text" name="phone" placeholder="e.g. 254712345678" required>
                    <button type="submit">Fetch Code</button>
                </form>
            </div>
        </div>
        <br><button onclick="window.location.reload()">🔄 Refresh</button>
    </body>
    </html>
    `;
}

app.get('/', (req, res) => res.send(getHtmlDashboard(currentQrImageUrl, livePairingCode, botStatus)));
app.get('/api/status', (req, res) => res.json({ status: botStatus }));

app.get('/get-text-code', async (req, res) => {
    let rawPhone = req.query.phone;
    if (!rawPhone) return res.redirect('/');
    const cleanedNumber = rawPhone.replace(/[^0-9]/g, '');
    livePairingCode = "FETCHING...";
    initializeSocket(cleanedNumber);
    setTimeout(() => res.redirect('/'), 4000);
});

async function initializeSocket(requestedPhoneNumber = null) {
    const { state, saveCreds } = await useMultiFileAuthState('session_storage_v2');
    const { version } = await fetchLatestBaileysVersion();
    if (globalSock) try { globalSock.end(); } catch(e) {}

    globalSock = makeWASocket({
        version, logger: pino({ level: 'silent' }), auth: state, printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    if (requestedPhoneNumber) {
        setTimeout(async () => {
            try {
                livePairingCode = await globalSock.requestPairingCode(requestedPhoneNumber);
            } catch (err) { livePairingCode = "REJECTED"; }
        }, 4000);
    }

    globalSock.ev.on('connection.update', async (update) => {
        const { connection, qr } = update;
        if (qr) currentQrImageUrl = await QRCode.toDataURL(qr);
        if (connection === 'close') {
            botStatus = "Disconnected";
            currentQrImageUrl = "";
            initializeSocket();
        } else if (connection === 'open') {
            botStatus = "Connected";
            currentQrImageUrl = "";
            livePairingCode = "SUCCESSFUL LINK ✅";
        }
    });
    globalSock.ev.on('creds.update', saveCreds);
}

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    initializeSocket().catch(console.error);
});
