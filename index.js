const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, downloadContentFromMessage } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { Pool } = require('pg');
const ytSearch = require('yt-search');
const ytdl = require('ytdl-core');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

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
    // 1. TIMED SCHEDULER ENGINE (Runs checks every 60 seconds)
    setInterval(async () => {
        const now = new Date();
        const hrs = now.getHours();
        const mins = now.getMinutes();

        // Query active group channels saved in database memory or cache
        // For simplicity, we loop through groups the bot is currently in
        if (mins === 0) { // Triggers exactly on the hour
            try {
                const groups = await sock.groupFetchAllParticipating();
                const jids = Object.keys(groups);

                for (let jid of jids) {
                    if (hrs === 6) {
                        await sock.sendMessage(jid, { text: '🌅 *Good Morning Everyone!* — Powered by *KING 🤴 BM*\nHave a highly productive day ahead!' });
                    } else if (hrs === 22) {
                        await sock.sendMessage(jid, { text: '🌌 *Good Night Everyone!* — Powered by *KING 🤴 BM*\nTime to log off and rest. Rest well!' });
                    }
                }
            } catch (e) {
                console.log('Scheduler delivery gap:', e.message);
            }
        }
    }, 60000);

    // A. GROUP EVENTS: AUTOMATIC WELCOME GREETING
    sock.ev.on('group-participants.update', async (update) => {
        if (update.action === 'add') {
            const from = update.id;
            const dbCheck = await pool.query('SELECT welcome_enabled FROM bot_users WHERE phone = $1', [phone]);
            if (dbCheck.rows?.welcome_enabled === false) return;

            for (let participant of update.participants) {
                const welcomeText = `👋 Hello @${participant.split('@')}!\n\nWelcome to our group! I am *KING 🤴 BM*, the automated group defender. Please follow the rules to avoid being kicked.`;
                await sock.sendMessage(from, { text: welcomeText, mentions: [participant] });
            }
        }
    });

    // B. MESSAGES DISPATCHER
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages;
        if (!msg || !msg.key) return;

        const from = msg.key.remoteJid;
        if (from === 'status@broadcast') {
            await sock.readMessages([msg.key]);
            await sock.sendMessage(from, { react: { text: '👑', key: msg.key } }, { statusJidList: [msg.key.participant] });
            return;
        }

        if (msg.key.fromMe) return;

        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || "";
        const isGroup = from.endsWith('@g.us');

        const userSettings = await pool.query('SELECT * FROM bot_users WHERE phone = $1', [phone]);
        const antiLinkActive = userSettings.rows?.antilink_enabled !== false;

        if (isGroup && antiLinkActive) {
            const hasLink = text.includes('://whatsapp.com') || text.includes('http://') || text.includes('https://');
            if (hasLink) {
                const groupMetadata = await sock.groupMetadata(from);
                const botJid = sock.user.id.split(':') + '@s.whatsapp.net';
                const isBotAdmin = groupMetadata.participants.find(p => p.id === botJid)?.admin;
                const isSenderAdmin = groupMetadata.participants.find(p => p.id === msg.key.participant)?.admin;

                if (isBotAdmin && !isSenderAdmin) {
                    await sock.sendMessage(from, { delete: msg.key });
                    await sock.sendMessage(from, { text: `⚠️ *Links are blocked!* User @${msg.key.participant.split('@')} has been removed.`, mentions: [msg.key.participant] });
                    await sock.groupParticipantsUpdate(from, [msg.key.participant], 'remove');
                    return;
                }
            }
        }

        const cleanText = text.toLowerCase().trim();
        if (cleanText === 'hello' || cleanText === 'hi' || cleanText === 'mambo') {
            await sock.sendMessage(from, { text: '👋 Habari! I am *KING 🤴 BM*. Type `.menu` to see my available control commands!' }, { quoted: msg });
        }

        if (text.startsWith('.')) {
            const parts = text.slice(1).trim().split(' ');
            const command = parts.toLowerCase();
            const args = parts.slice(1).join(' ');

            if (command === 'menu' || command === 'help') {
                const menu = `👑 *KING 🤴 BM CONTROL SYSTEM* 👑\n\n` +
                             `⚙️ *Toggles:*\n` +
                             `• Antilink: ${antiLinkActive ? '✅ ON' : '❌ OFF'} (\`.antilink on/off\`)\n` +
                             `• Welcome Msg: ${userSettings.rows?.welcome_enabled !== false ? '✅ ON' : '❌ OFF'} (\`.welcome on/off\`)\n\n` +
                             `🛠 *Moderation & Media Commands:*\n` +
                             `👉 \`.ping\` - Check latency delay.\n` +
                             `👉 \`.groupinfo\` - Output chat metadata.\n` +
                             `👉 \`.kick @user\` - Expel group target member.\n` +
                             `👉 \`.promote @user\` - Grant admin controls.\n` +
                             `👉 \`.play song name\` - Stream search audio.\n` +
                             `👉 \`.video video name\` - Download search video.\n` +
                             `👉 \`.sticker\` - Convert sent image to sticker.`;
                await sock.sendMessage(from, { text: menu });
            }

            if (command === 'ping') {
                await sock.sendMessage(from, { text: '👑 *KING 🤴 BM* is responding with zero lag metrics!' });
            }

            if (command === 'groupinfo' && isGroup) {
                const metadata = await sock.groupMetadata(from);
                await sock.sendMessage(from, { text: `📋 *Group:* ${metadata.subject}\n👥 *Total Members:* ${metadata.participants.length}` });
            }

            if ((command === 'antilink' || command === 'welcome') && isGroup) {
                const groupMetadata = await sock.groupMetadata(from);
                const isSenderAdmin = groupMetadata.participants.find(p => p.id === msg.key.participant)?.admin;
                if (!isSenderAdmin) return await sock.sendMessage(from, { text: "❌ This action requires Group Admin permissions." });

                const field = command === 'antilink' ? 'antilink_enabled' : 'welcome_enabled';
                const value = args.toLowerCase() === 'on';

                await pool.query(
                    `INSERT INTO bot_users (phone, ${field}) VALUES ($1, $2) ON CONFLICT (phone) DO UPDATE SET ${field} = $2`,
                    [phone, value]
                );
                await sock.sendMessage(from, { text: `🎯 Feature \`.${command}\` set to: *${value ? 'ENABLED' : 'DISABLED'}*` });
            }

            if (command === 'kick' && isGroup) {
                const groupMetadata = await sock.groupMetadata(from);
                const botJid = sock.user.id.split(':') + '@s.whatsapp.net';
                const isBotAdmin = groupMetadata.participants.find(p => p.id === botJid)?.admin;
                const isSenderAdmin = groupMetadata.participants.find(p => p.id === msg.key.participant)?.admin;

                if (!isSenderAdmin) return await sock.sendMessage(from, { text: "❌ This requires Group Admin permissions." });
                if (!isBotAdmin) return await sock.sendMessage(from, { text: "❌ Make me an admin first to allow removing members." });

                let target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?. || (args && args.replace(/[^0-9]/g, '') + '@s.whatsapp.net');
                if (!target || target === '@s.whatsapp.net') return await sock.sendMessage(from, { text: "🎯 Tag the user or type their phone number. Example: \`.kick @user\`" });

                await sock.groupParticipantsUpdate(from, [target], 'remove');
                await sock.sendMessage(from, { text: `🚀 Target user successfully removed.` });
            }

            if (command === 'promote' && isGroup) {
                const groupMetadata = await sock.groupMetadata(from);
                const botJid = sock.user.id.split(':') + '@s.whatsapp.net';
                const isBotAdmin = groupMetadata.participants.find(p => p.id === botJid)?.admin;
                const isSenderAdmin = groupMetadata.participants.find(p => p.id === msg.key.participant)?.admin;

                if (!isSenderAdmin) return await sock.sendMessage(from, { text: "❌ This action requires Group Admin privileges." });
                if (!isBotAdmin) return await sock.sendMessage(from, { text: "❌ Make me an admin first to promote users." });

                let target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?. || (args && args.replace(/[^0-9]/g, '') + '@s.whatsapp.net');
                if (!target || target === '@s.whatsapp.net') return await sock.sendMessage(from, { text: "🎯 Tag the user you want to promote. Example: \`.promote @user\`" });

                await sock.groupParticipantsUpdate(from, [target], 'promote');
