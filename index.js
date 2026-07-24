const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, jidDecode } = require('@whiskeysockets/baileys');
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

// Settings config (Can be converted to database toggles later)
const botSettings = {
    autoViewStatus: true,
    autoReactStatus: true,
    antiLink: true,
    statusReactionEmoji: '👑'
};

function startBotLogic(sock) {
    // 1. ADVANCED AUTOMATIONS: STATUS HANDLING
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.key) return;

        const from = msg.key.remoteJid;

        // Auto View Status & Auto React Status
        if (from === 'status@broadcast') {
            if (botSettings.autoViewStatus) {
                await sock.readMessages([msg.key]);
                console.log(`[KING 🤴 BM] Automatically viewed status from: ${msg.key.participant}`);
            }
            if (botSettings.autoReactStatus) {
                await sock.sendMessage(from, {
                    react: { text: botSettings.statusReactionEmoji, key: msg.key }
                }, { statusJidList: [msg.key.participant] });
            }
            return;
        }

        // Ignore messages sent by the bot itself
        if (msg.key.fromMe) return;

        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
        const isGroup = from.endsWith('@g.us');

        // 2. SAFETY ENGINE: ANTILINK
        if (isGroup && botSettings.antiLink) {
            const hasLink = text.includes('://whatsapp.com') || text.includes('http://') || text.includes('https://');
            if (hasLink) {
                const groupMetadata = await sock.groupMetadata(from);
                const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                const isBotAdmin = groupMetadata.participants.find(p => p.id === botJid)?.admin;

                // Check if sender is an admin
                const isSenderAdmin = groupMetadata.participants.find(p => p.id === msg.key.participant)?.admin;

                if (isBotAdmin && !isSenderAdmin) {
                    // Delete the forbidden link message
                    await sock.sendMessage(from, { delete: msg.key });
                    
                    // Send alert message
                    await sock.sendMessage(from, { text: `⚠️ *Links are strictly forbidden here!* @${msg.key.participant.split('@')[0]}, you have been removed.`, mentions: [msg.key.participant] });
                    
                    // Kick the user
                    await sock.groupParticipantsUpdate(from, [msg.key.participant], 'remove');
                    return; 
                }
            }
        }

        // 3. CENTRAL COMMAND CORE
        if (text.startsWith('.')) {
            const command = text.slice(1).trim().toLowerCase();

            // Menu Display
            if (command === 'menu' || command === 'help') {
                const menuText = `👑 *KING 🤴 BM PLATFORM MENU* 👑\n\n` +
                                 `🤖 *Automation Features (Active):*\n` +
                                 `• Auto View Status: ${botSettings.autoViewStatus ? '✅' : '❌'}\n` +
                                 `• Auto React Status: ${botSettings.autoReactStatus ? '✅' : '❌'}\n` +
                                 `• Anti-Link Filter: ${botSettings.antiLink ? '✅' : '❌'}\n\n` +
                                 `🛠️ *Available Commands:*\n` +
                                 `👉 \`.ping\` - Test if server is responsive.\n` +
                                 `👉 \`.menu\` - Display this dashboard module.\n` +
                                 `👉 \`.groupinfo\` - Display current group context metrics.`;
                await sock.sendMessage(from, { text: menuText });
            }

            // Ping Check
            if (command === 'ping') {
                await sock.sendMessage(from, { text: '👑 *KING 🤴 BM* is fully operational and monitoring channels!' });
            }

            // Group Info Diagnostic
            if (command === 'groupinfo' && isGroup) {
                const metadata = await sock.groupMetadata(from);
                await sock.sendMessage(from, { text: `📋 *Group:* ${metadata.subject}\n👥 *Members:* ${metadata.participants.length}` });
            }
        }
    });
}

app.post('/pair', async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Provide a phone number" });

    try {
        const { state, saveCreds } = await useMultiFileAuthState(`./sessions/${phone}`);
        const sock = makeWASocket({
            auth: state,
            logger: pino({ level: 'silent' }),
            mobile: false
        });

        sock.ev.on('creds.update', saveCreds);
        startBotLogic(sock);

        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(phone);
                res.json({ success: true, code: code });
            } catch (err) {
                res.status(500).json({ error: "Pairing timeout. Please refresh and try again." });
            }
        }, 3000);

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`KING BM Core listening on port ${PORT}`));
