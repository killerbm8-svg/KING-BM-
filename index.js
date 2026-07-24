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

// Setup database tables on startup
async function setupDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS bot_users (
            phone TEXT PRIMARY KEY,
            antilink_enabled BOOLEAN DEFAULT TRUE,
            welcome_enabled BOOLEAN DEFAULT TRUE
        );
    `);
}
setupDatabase().catch(console.error);

function startBotLogic(sock, phone) {
    // A. GROUP EVENTS: AUTOMATIC WELCOME GREETING
    sock.ev.on('group-participants.update', async (update) => {
        if (update.action === 'add') {
            const from = update.id;
            
            // Query database to ensure welcome configuration is active
            const dbCheck = await pool.query('SELECT welcome_enabled FROM bot_users WHERE phone = $1', [phone]);
            if (dbCheck.rows[0]?.welcome_enabled === false) return;

            for (let participant of update.participants) {
                const welcomeText = `👋 Hello @${participant.split('@')[0]}!\n\nWelcome to our group! I am *KING 🤴 BM*, the automated group defender. Please follow the rules to avoid being kicked.`;
                await sock.sendMessage(from, { text: welcomeText, mentions: [participant] });
            }
        }
    });

    // B. MESSAGES DISPATCHER: COMMAND CORES & FILTER CORES
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg || !msg.key) return;

        const from = msg.key.remoteJid;
        if (from === 'status@broadcast') {
            // Auto view and react to status posts
            await sock.readMessages([msg.key]);
            await sock.sendMessage(from, { react: { text: '👑', key: msg.key } }, { statusJidList: [msg.key.participant] });
            return;
        }

        if (msg.key.fromMe) return;

        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
        const isGroup = from.endsWith('@g.us');

        // Fetch custom preference state from database memory
        const userSettings = await pool.query('SELECT * FROM bot_users WHERE phone = $1', [phone]);
        const antiLinkActive = userSettings.rows[0]?.antilink_enabled !== false;

        // Group Protection Filter Logic
        if (isGroup && antiLinkActive) {
            const hasLink = text.includes('://whatsapp.com') || text.includes('http://') || text.includes('https://');
            if (hasLink) {
                const groupMetadata = await sock.groupMetadata(from);
                const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                const isBotAdmin = groupMetadata.participants.find(p => p.id === botJid)?.admin;
                const isSenderAdmin = groupMetadata.participants.find(p => p.id === msg.key.participant)?.admin;

                if (isBotAdmin && !isSenderAdmin) {
                    await sock.sendMessage(from, { delete: msg.key });
                    await sock.sendMessage(from, { text: `⚠️ *Links are blocked!* User @${msg.key.participant.split('@')[0]} has been removed.`, mentions: [msg.key.participant] });
                    await sock.groupParticipantsUpdate(from, [msg.key.participant], 'remove');
                    return;
                }
            }
        }

        // Processing Runtime Commands
        if (text.startsWith('.')) {
            const parts = text.slice(1).trim().split(' ');
            const command = parts[0].toLowerCase();
            const args = parts.slice(1).join(' ');

            if (command === 'menu' || command === 'help') {
                const menu = `👑 *KING 🤴 BM CORE CONTROL* 👑\n\n` +
                             `⚙️ *Toggles (Use commands to switch):*\n` +
                             `• Antilink: ${antiLinkActive ? '✅ ON' : '❌ OFF'} (\`.antilink on/off\`)\n` +
                             `• Welcome Msg: ${userSettings.rows[0]?.welcome_enabled !== false ? '✅ ON' : '❌ OFF'} (\`.welcome on/off\`)\n\n` +
                             `🛠️ *Commands:*\n` +
                             `👉 \`.ping\` - Check live platform delay latency.\n` +
                             `👉 \`.groupinfo\` - Output meta components of current chat.`;
                await sock.sendMessage(from, { text: menu });
            }

            if (command === 'ping') {
                await sock.sendMessage(from, { text: '👑 *KING 🤴 BM* is responding with zero lag metrics!' });
            }

            // Command to switch configurations dynamically via chat
            if ((command === 'antilink' || command === 'welcome') && isGroup) {
                const groupMetadata = await sock.groupMetadata(from);
                const isSenderAdmin = groupMetadata.participants.find(p => p.id === msg.key.participant)?.admin;
                if (!isSenderAdmin) return await sock.sendMessage(from, { text: "❌ This control action requires Group Admin permissions." });

                const field = command === 'antilink' ? 'antilink_enabled' : 'welcome_enabled';
                const value = args.toLowerCase() === 'on';

                await pool.query(
                    `INSERT INTO bot_users (phone, ${field}) VALUES ($1, $2) ON CONFLICT (phone) DO UPDATE SET ${field} = $2`,
                    [phone, value]
                );
                await sock.sendMessage(from, { text: `🎯 *Configuration updated!* Feature \`.${command}\` set to: *${value ? 'ENABLED' : 'DISABLED'}*` });
            }

            if (command === 'groupinfo' && isGroup) {
                const metadata = await sock.groupMetadata(from);
                await sock.sendMessage(from, { text: `📋 *Group:* ${metadata.subject}\n👥 *Total Members:* ${metadata.participants.length}` });
            }
        }
    });
}

// REST Portal Handler Engine
app.post('/pair', async (req, res) => {
    const { phone, password } = req.body;
    
    // Validate System Master Password
    if (password !== process.env.MASTER_PASSWORD) {
        return res.status(401).json({ error: "Invalid master authentication token" });
    }
    if (!phone) return res.status(400).json({ error: "Missing Target Phone Parameter" });

    try {
        const { state, saveCreds } = await useMultiFileAuthState(`./sessions/${phone}`);
        const sock = makeWASocket({
            auth: state,
            logger: pino({ level: 'silent' })
        });

        sock.ev.on('creds.update', saveCreds);
        startBotLogic(sock, phone);

        // Populate initial database profile configuration record
        await pool.query('INSERT INTO bot_users (phone) VALUES ($1) ON CONFLICT (phone) DO NOTHING', [phone]);

        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(phone);
                res.json({ success: true, code: code });
            } catch (err) {
                res.status(500).json({ error: "Token generation timed out. Try again." });
            }
        }, 3000);

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`KING BM Multi-Session Controller active on node:${PORT}`));
