const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    downloadMediaMessage 
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const fs = require('fs');
const exec = require('child_process').exec;
const axios = require('axios');
const qrcode = require('qrcode-terminal');

// Configuration Settings
const PREFIX = ".";
const BOT_NAME = "KING BM PRO";

async function startBot() {
    // Manages session authentication memory folders safely
    const { state, saveCreds } = await useMultiFileAuthState('./session_auth_data');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: true
    });

    // Save credentials when updated
    sock.ev.on('creds.update', saveCreds);

    // Track Connection State Changes
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('--- SCAN THE QR CODE BELOW TO CONNECT ---');
            qrcode.generate(qr, { small: true });
        }
        
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom) 
                ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut 
                : true;
            console.log('Connection closed due to error, reconnecting: ', shouldReconnect);
            if (shouldReconnect) {
                startBot();
            }
        } else if (connection === 'open') {
            console.log(`🟢 ${BOT_NAME} Successfully Connected to WhatsApp!`);
        }
    });

    // Core Message Listening & Unified Command Core Handler
    sock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            const msg = chatUpdate.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const chatId = msg.key.remoteJid;
            const isGroup = chatId.endsWith('@g.us');
            
            // Extract textual contents across text, captions, and links
            const messageText = msg.message.conversation || 
                                msg.message.extendedTextMessage?.text || 
                                msg.message.imageMessage?.caption || 
                                msg.message.videoMessage?.caption || "";
            
            // Safe exit if prefix criteria isn't met
            if (!messageText.startsWith(PREFIX)) return;

            // Parsing structures splits terms and isolate variables
            const args = messageText.slice(PREFIX.length).trim().split(/ +/);
            const command = args.shift().toLowerCase();
            const sender = msg.key.participant || msg.key.remoteJid;

            // Fetch structural data fields for Group Admin Checkers
            let groupMetadata = isGroup ? await sock.groupMetadata(chatId) : null;
            let groupAdmins = isGroup ? groupMetadata.participants.filter(p => p.admin).map(p => p.id) : [];
            let isBotAdmin = isGroup ? groupAdmins.includes(sock.user.id.split(':')[0] + '@s.whatsapp.net') : false;
            let isSenderAdmin = isGroup ? groupAdmins.includes(sender) : false;

            // Execute Actions via System Command Router Switch
            switch (command) {
                
                case "menu":
                case "help":
                    const menuText = `👑 *${BOT_NAME} COMMAND MENU* 🤴\n\n` +
                        `*Prefix:* [ ${PREFIX} ]\n\n` +
                        `⚙️ *SYSTEM COMMANDS*\n` +
                        `▫️ \`${PREFIX}ping\` - Check latency metrics.\n` +
                        `▫️ \`${PREFIX}runtime\` - View bot online uptime.\n\n` +
                        `👥 *GROUP ADMIN TOOLS*\n` +
                        `▫️ \`${PREFIX}groupinfo\` - Display group parameters.\n` +
                        `▫️ \`${PREFIX}kick @user\` - Expel a user from chat.\n` +
                        `▫️ \`${PREFIX}tagall\` - Tag all chat members.\n` +
                        `▫️ \`${PREFIX}link\` - Retrieve group invite link.\n\n` +
                        `🎨 *CONVERTERS*\n` +
                        `▫️ \`${PREFIX}sticker\` (or \`${PREFIX}s\`) - Media to sticker.\n\n` +
                        `🧠 *UTILITIES & SEARCH*\n` +
                        `▫️ \`${PREFIX}weather [city]\` - Get climate reports.\n\n` +
                        `_*KING BM PRO © 2026 | Developed by Killer Bm*_`;
                    
                    await sock.sendMessage(chatId, { text: menuText }, { quoted: msg });
                    break;

                case "ping":
                    const startTime = Date.now();
                    await sock.sendMessage(chatId, { text: "⏳ Analyzing connection node..." }, { quoted: msg });
                    const latency = Date.now() - startTime;
                    await sock.sendMessage(chatId, { text: `🤖 *Pong!* Response Latency: *${latency}ms*` }, { quoted: msg });
                    break;

                case "runtime":
                    const uptime = process.uptime();
                    const hours = Math.floor(uptime / 3600);
                    const minutes = Math.floor((uptime % 3600) / 60);
                    const seconds = Math.floor(uptime % 60);
                    await sock.sendMessage(chatId, { text: `⏳ *Uptime:* ${hours}h ${minutes}m ${seconds}s` }, { quoted: msg });
                    break;

                case "groupinfo":
                    if (!isGroup) return sock.sendMessage(chatId, { text: "❌ This command is restricted to group chats only." });
                    const infoText = `📊 *GROUP METRICS*\n\n` +
                        `📝 *Subject:* ${groupMetadata.subject}\n` +
                        `🆔 *ID:* ${groupMetadata.id}\n` +
                        `👥 *Total Participants:* ${groupMetadata.participants.length}\n` +
                        `👑 *Admins Total:* ${groupAdmins.length}`;
                    await sock.sendMessage(chatId, { text: infoText }, { quoted: msg });
                    break;

                case "kick":
                    if (!isGroup) return sock.sendMessage(chatId, { text: "❌ This command only works in group environments." });
                    if (!isBotAdmin) return sock.sendMessage(chatId, { text: "❌ Elevation required: Make the bot an admin." });
                    if (!isSenderAdmin) return sock.sendMessage(chatId, { text: "❌ Execution denied: Only Admins can invoke kick actions." });

                    let userToKick = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                    if (!userToKick && msg.message.extendedTextMessage?.contextInfo?.quotedMessage) {
                        userToKick = msg.message.extendedTextMessage.contextInfo.participant;
                    }
                    if (!userToKick && args[0]) {
                        userToKick = args[0].replace(/[^0-9]/g, '') + "@s.whatsapp.net";
                    }

                    if (!userToKick) return sock.sendMessage(chatId, { text: "👉 Mention, tag, or reply to a participant to expel them." });

                    await sock.groupParticipantsUpdate(chatId, [userToKick], "remove");
                    await sock.sendMessage(chatId, { text: "✅ Target user removed successfully." }, { quoted: msg });
                    break;

                case "tagall":
                    if (!isGroup) return;
                    if (!isSenderAdmin) return sock.sendMessage(chatId, { text: "❌ Admin privileges required." });

                    let participants = groupMetadata.participants.map(p => p.id);
                    let tagMessage = `📢 *Attention Everyone!*\n\n*Message:* ${args.join(" ") || "No notice broadcasted."}\n\n`;
                    for (let mem of participants) {
                        tagMessage += `👤 @${mem.split("@")[0]}\n`;
                    }
                    await sock.sendMessage(chatId, { text: tagMessage, mentions: participants });
                    break;

                case "link":
                case "invite":
                    if (!isGroup) return;
                    if (!isBotAdmin) return sock.sendMessage(chatId, { text: "❌ Bot administrative access is required to read links." });
                    const inviteCode = await sock.groupInviteCode(chatId);
                    await sock.sendMessage(chatId, { text: `🔗 *Group Invite Link:* https://whatsapp.com{inviteCode}` }, { quoted: msg });
                    break;

                case "weather":
                    if (args.length === 0) return sock.sendMessage(chatId, { text: "🔍 Specify target city: Ex: `.weather Nairobi`" });
                    try {
                        const city = args.join(" ");
                        const res = await axios.get(`https://wttr.in{city}?format=3`);
                        await sock.sendMessage(chatId, { text: `🌤 *Weather Metrics:* ${res.data.trim()}` }, { quoted: msg });
                    } catch {
                        await sock.sendMessage(chatId, { text: "❌ Target location unrecognized or communication timeout." });
                    }
                    break;

                case "sticker":
                case "s":
                    // Isolating media variables from original or replied message frames
                    const isMessageImage = msg.message.imageMessage;
                    const isMessageVideo = msg.message.videoMessage;
                    const isQuotedImage = msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
                    const isQuotedVideo = msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage;

                    if (!isMessageImage && !isMessageVideo && !isQuotedImage && !isQuotedVideo) {
                        return sock.sendMessage(chatId, { text: "📷 Tag or send an image or brief video clip using `.sticker`" });

