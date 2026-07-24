const express = require('express');
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

// Connect to Neon.tech Database
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Automatically create settings table if it doesn't exist
async function initDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS group_settings (
                chat_id TEXT PRIMARY KEY,
                antilink BOOLEAN DEFAULT TRUE,
                autoviewstatus BOOLEAN DEFAULT TRUE,
                autoreactstatus BOOLEAN DEFAULT TRUE
            );
        `);
        console.log("Database tables verified successfully.");
    } catch (err) {
        console.error("Database initialization failed:", err);
    }
}
initDatabase();

// Helper functions to handle database settings cleanly
async function getSettings(chatId) {
    const res = await pool.query('SELECT * FROM group_settings WHERE chat_id = $1', [chatId]);
    if (res.rows.length === 0) {
        // Insert default values for a new chat
        const defaultSettings = await pool.query(
            'INSERT INTO group_settings (chat_id) VALUES ($1) RETURNING *',
            [chatId]
        );
        return defaultSettings.rows[0];
    }
    return res.rows[0];
}

async function updateSetting(chatId, column, value) {
    await pool.query(`UPDATE group_settings SET ${column} = $1 WHERE chat_id = $2`, [value, chatId]);
}

function startBotLogic(sock) {
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg || !msg.key) return;

        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');

        // 1. STATUS HANDLER (Global / Private Settings)
        if (from === 'status@broadcast') {
            const settings = await getSettings('status_global');
            if (settings.autoviewstatus) {
                await sock.readMessages([msg.key]);
            }
            if (settings.autoreactstatus) {
                await sock.sendMessage(from, { react: { text: '👑', key: msg.key } }, { statusJidList: [msg.key.participant] });
            }
            return;
        }

        if (msg.key.fromMe) return;

        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
        
        // Fetch specific settings for this group or direct chat
        const currentSettings = await getSettings(from);

        // 2. ANTILINK CHECKER
        if (isGroup && currentSettings.antilink) {
            const hasLink = text.includes('://whatsapp.com') || text.includes('http://') || text.includes('https://');
            if (hasLink) {
                try {
                    const groupMetadata = await sock.groupMetadata(from);
                    const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                    
                    const isBotAdmin = groupMetadata.participants.find(p => p.id === botJid)?.admin;
                    const isSenderAdmin = groupMetadata.participants.find(p => p.id === msg.key.participant)?.admin;

                    if (isBotAdmin && !isSenderAdmin) {
                        await sock.sendMessage(from, { delete: msg.key });
                        await sock.sendMessage(from, { 
                            text: `⚠️ *Links are strictly forbidden!* @${msg.key.participant.split('@')[0]}, you have been removed.`, 
                            mentions: [msg.key.participant] 
                        });
                        await sock.groupParticipantsUpdate(from, [msg.key.participant], 'remove');
                        return;
                    }
                } catch (e) {
                    console.log("Error processing antilink permissions:", e.message);
                }
            }
        }

        // 3. COMMAND ENGINE
        if (text.startsWith('.')) {
            const args = text.slice(1).trim().split(/ +/);
            const command = args.shift().toLowerCase();

            // Menu Dashboard
            if (command === 'menu' || command === 'help') {
                const statusSettings = await getSettings('status_global');
                const menuText = `👑 *KING 🤴 BM MANAGER* 👑\n\n` +
                                 `⚙️ *Current Group Settings:*\n` +
                                 `• Anti-Link Filter: ${currentSettings.antilink ? '✅ ON' : '❌ OFF'}\n` +
                                 `• Auto Status View: ${statusSettings.autoviewstatus ? '✅ ON' : '❌ OFF'}\n` +
                                 `• Auto Status React: ${statusSettings.autoreactstatus ? '✅ ON' : '❌ OFF'}\n\n` +
                                 `🛠️ *Admin Group Controls:*\n` +
                                 `👉 \`.antilink on\` / \`.antilink off\`\n` +
                                 `👉 \`.autostatus on\` / \`.autostatus off\`\n\n` +
                                 `📋 *General Commands:*\n` +
                                 `👉 \`.ping\` - Server response test.\n` +
                                 `👉 \`.groupinfo\` - Read group metrics.`;
                await sock.sendMessage(from, { text: menuText });
                return;
            }

            if (command === 'ping') {
                await sock.sendMessage(from, { text: '👑 *KING 🤴 BM* engine is operational!' });
                return;
            }

            // ADMIN AUTHORIZATION VERIFICATION LOGIC
            let isAdmin = false;
            if (isGroup) {
                try {
                    const metadata = await sock.groupMetadata(from);
                    isAdmin = metadata.participants.find(p => p.id === msg.key.participant)?.admin ? true : false;
                } catch (err) {
                    isAdmin = false;
                }
            } else {
                isAdmin = true; // Always admin in private messages
            }

            // Toggle Handler: Antilink
            if (command === 'antilink') {
                if (!isAdmin) return await sock.sendMessage(from, { text: "❌ *Access Denied:* This command is restricted to group admins." });
                const targetState = args[0]?.toLowerCase();

                if (targetState === 'on') {
                    await updateSetting(from, 'antilink', true);
                    await sock.sendMessage(from, { text: "✅ *Anti-Link Shield Active.* Guarding group against spam links." });
                } else if (targetState === 'off') {
                    await updateSetting(from, 'antilink', false);
                    await sock.sendMessage(from, { text: "🔓 *Anti-Link Deactivated.* Users can now share links freely." });
                } else {
                    await sock.sendMessage(from, { text: "📋 Usage: \`.antilink on\` or \`.antilink off\`" });
                }
                return;
            }

            // Toggle Handler: Auto Status View/React
            if (command === 'autostatus') {
                if (!isAdmin) return await sock.sendMessage(from, { text: "❌ Admin privileges required." });
                const targetState = args[0]?.toLowerCase();

                if (targetState === 'on') {
                    await updateSetting('status_global', 'autoviewstatus', true);
                    await updateSetting('status_global', 'autoreactstatus', true);
                    await sock.sendMessage(from, { text: "✅ *Auto Status Actions Enabled Globally.*" });
                } else if (targetState === 'off') {
                    await updateSetting('status_global', 'autoviewstatus', false);
                    await updateSetting('status_global', 'autoreactstatus', false);
                    await sock.sendMessage(from, { text: "🛑 *Auto Status Actions Suspended Globally.*" });
                } else {
                    await sock.sendMessage(from, { text: "📋 Usage: \`.autostatus on\` or \`.autostatus off\`" });
                }
                return;
            }

            if (command === 'groupinfo' && isGroup) {
                const metadata = await sock.groupMetadata(from);
                await sock.sendMessage(from, { text: `📋 *Group Name:* ${metadata.subject}\n👥 *Total Members:* ${metadata.participants.length}` });
            }
        }
    });
}

app.post('/pair', async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Provide a phone number" });

    try {
        const { state, saveCreds } = await useMultiFileAuthState(`./sessions/${phone}`);
        const sock = makeWASocket({ auth: state, logger: pino({ level: 'silent' }) });
        sock.ev.on('creds.update', saveCreds);
        startBotLogic(sock);

        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(phone);
                res.json({ success: true, code: code });
            } catch (err) {
                res.status(500).json({ error: "Connection setup timed out." });
            }
        }, 3000);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`KING BM server running.`));
