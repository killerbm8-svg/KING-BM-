const express = require('express');
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    Browsers 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const { Boom } = require('@hapi/boom');

const app = express();
const port = process.env.PORT || 3000;

// Simple web endpoint to satisfy hosting provider uptime monitoring
app.get('/', (req, res) => {
    res.send('KING-BM Bot is active and running.');
});

app.listen(port, () => {
    console.log(`Web application container listening on port ${port}`);
});

async function connectToWhatsApp() {
    // Initializes session tracking in a local directory folder
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_multi');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }), // Suppresses flooding logs to protect terminal performance
        auth: state,
        printQRInTerminal: false, // Forces pairing code functionality over QR engine
        // Crucial: Set a standard browser fingerprint to stop WhatsApp from rejecting the code
        browser: Browsers.ubuntu('Chrome'), 
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 30000
    });

    // Automatically triggers pairing code extraction via environment variables or console argument
    const targetPhone = process.env.PHONE_NUMBER; 
    if (targetPhone && !sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                // Cleans raw numbers to exact E.164 string format
                const cleanedNumber = targetPhone.replace(/[^0-9]/g, '');
                console.log(`[SYSTEM] Initializing request for pairing code: ${cleanedNumber}`);
                const pairingCode = await sock.requestPairingCode(cleanedNumber);
                console.log(`\n==========================================\n`);
                console.log(`YOUR WHATSAPP PAIRING CODE: ${pairingCode}`);
                console.log(`\n==========================================\n`);
            } catch (pairingError) {
                console.error('[ERROR] Failed to fetch pairing code:', pairingError.message);
            }
        }, 5000); // 5-second buffer to stabilize network handshake
    }

    // Handles reconnection state alterations natively
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom) 
                ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut 
                : true;
            console.log('[SYSTEM] Connection lost due to error. Reconnecting status:', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('[SUCCESS] WhatsApp device successfully linked to KING-BM bot structure.');
        }
    });

    // Event listener to periodically save session validation data securely
    sock.ev.on('creds.update', saveCreds);

    // Simple ping command architecture
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const from = msg.key.remoteJid;

        if (text.toLowerCase() === '.ping') {
            await sock.sendMessage(from, { text: 'Pong! 👑 KING-BM is online.' }, { quoted: msg });
        }
    });
}

// Launches core engine loop
connectToWhatsApp().catch(err => console.error('[CRITICAL RUNTIME ERROR]:', err));
