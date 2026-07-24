const express = require('express');
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Setup continuous command listener
function startBotLogic(sock) {
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const from = msg.key.remoteJid;

        if (text.toLowerCase() === '.ping') {
            await sock.sendMessage(from, { text: '👑 *KING 🤴 BM* is fully operational and online!' });
               }
    });
}

// Endpoint to generate 8-digit connection code
app.post('/pair', async (req, res) => {
    const { phone } = req.body; // e.g. "2547XXXXXXXX"
    if (!phone) return res.status(400).json({ error: "Provide a phone number" });

    try {
        const { state, saveCreds } = await useMultiFileAuthState(`./sessions/${phone}`);
        const sock = makeWASocket({
            auth: state,
            logger: pino({ level: 'silent' })
        });

        sock.ev.on('creds.update', saveCreds);
        startBotLogic(sock);

        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(phone);
                res.json({ success: true, code: code });
            } catch (err) {
                res.status(500).json({ error: "Pairing timeout. Try again." });
            }
        }, 3000);

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server live on port ${PORT}`));
