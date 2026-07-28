const { makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const TelegramBot = require('node-telegram-bot-api');
const pino = require('pino');
const fs = require('fs');

// Read directly from the cloud environment configuration panel
const tgToken = process.env.TELEGRAM_BOT_TOKEN;
const botName = process.env.BOT_NAME || "KING 👑 BM";
const prefix = process.env.PREFIX || "/";

if (!tgToken) {
    console.error("❌ ERROR: TELEGRAM_BOT_TOKEN is missing!");
    process.exit(1);
}

// Initialize Telegram Handler
const tgBot = new TelegramBot(tgToken, { polling: true });
console.log(`🤖 Telegram Interface active for ${botName}`);

// --- MENU /START COMMAND ---
tgBot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const welcomeMenu = `
╭──────────────────────────╮
│ ⚙️ *BOT SYSTEM PANEL* ⚙️
╰──────────────────────────╯
🤖 *BOT NAME*   ::  👑 ${botName}
🎛️ *VERSION*    ::  1.0.0
🟢 *STATUS*     ::  ONLINE ✅
🌐 *PLATFORM*   ::  TELEGRAM / WHATSAPP
🔑 *PREFIX*     ::  \`${prefix}\`

────────────────────────────
⚔️  *BOT SYSTEM COMMANDS*  ⚔️
────────────────────────────
♦️ \`/connect\`  ➤ Pair your device link code
♦️ \`/delpair\`  ➤ Remove paired session keys
♦️ \`/listpair\` ➤ View active multi-device pairs

🔻 *JOIN OUR CHANNELS BELOW* 🔻
Please subscribe to stay updated with code updates and support!

_*POWERED BY KILLERBM8-SVG*_`;

    const options = {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [
                    // ⚠️ REPLACE WITH YOUR REAL WHATSAPP GROUP LINK
                    { text: '👥 WHATSAPP SUPPORT GROUP', url: 'https://whatsapp.com' }
                ],
                [
                    // ⚠️ REPLACE WITH YOUR REAL TELEGRAM CHANNEL LINK
                    { text: '📢 TELEGRAM CHANNEL', url: 'https://t.me' }
                ],
                [
                    // ⚠️ REPLACE WITH YOUR REAL WHATSAPP CHANNEL LINK
                    { text: '🟢 WHATSAPP CHANNEL', url: 'https://whatsapp.com' }
                ],
                [
                    // Links back to your GitHub repository
                    { text: '💻 REPOSITORY', url: 'https://github.com' }
                ]
            ]
        }
    };
    tgBot.sendMessage(chatId, welcomeMenu, options);
});

// --- CONNECT COMMAND ---
tgBot.onText(/\/connect/, async (msg) => {
    const chatId = msg.chat.id;
    tgBot.sendMessage(chatId, "⏳ _Generating pairing instance... Please reply with your phone number with country code (e.g. 2348012345678)._", { parse_mode: 'Markdown' });
    
    tgBot.once('message', async (nextMsg) => {
        if (nextMsg.text.startsWith('/')) return; 
        
        const rawNumber = nextMsg.text.replace(/[^0-9]/g, ''); 
        if (rawNumber.length < 10) {
            return tgBot.sendMessage(chatId, "❌ Invalid number format. Please provide your international country code first.");
        }

        try {
            tgBot.sendMessage(chatId, `🔁 _Requesting pairing code from WhatsApp servers for +${rawNumber}..._`, { parse_mode: 'Markdown' });
            
            const { state, saveCreds } = await useMultiFileAuthState(`sessions/${chatId}`);
            
            // FIXED: Added browser arrays to prevent immediate Connection Closed errors
            const sock = makeWASocket({
                auth: state,
                logger: pino({ level: 'silent' }),
                printQRInTerminal: false,
                browser: ["Ubuntu", "Chrome", "20.0.04"]
            });

            sock.ev.on('creds.update', saveCreds);

            sock.ev.on('connection.update', async (update) => {
                const { connection } = update;
                if (connection === 'close') {
                    console.log('Connection dropped, retrying handshake...');
                }
            });

            setTimeout(async () => {
                try {
                    let code = await sock.requestPairingCode(rawNumber); 
                    code = code?.match(/.{1,4}/g)?.join('-') || code; 
                    
                    const responseText = `✨ *PAIRING SUCCESSFUL* ✨\n\nYour deployment multi-device verification token is:\n\`${code}\`\n\n*Instructions:*\n1. Open WhatsApp on your phone.\n2. Tap *Linked Devices* ➜ *Link a Device*.\n3. Choose *Link with phone number instead*.\n4. Input the code displayed above.`;
                    tgBot.sendMessage(chatId, responseText, { parse_mode: 'Markdown' });
                } catch (err) {
                    tgBot.sendMessage(chatId, `❌ Code requests closed: ${err.message}. Please try typing /connect again.`);
                }
            }, 5000); // 5-second buffer to guarantee connection synchronization stability

        } catch (error) {
            tgBot.sendMessage(chatId, `❌ Failed to initialize pairing instance: ${error.message}`);
        }
    });
});

// --- LISTPAIR COMMAND ---
tgBot.onText(/\/listpair/, (msg) => {
    const chatId = msg.chat.id;
    const sessionPath = `sessions/${chatId}`;

    if (fs.existsSync(sessionPath) && fs.readdirSync(sessionPath).length > 0) {
        tgBot.sendMessage(chatId, `📱 *ACTIVE PAIRS* 📱\n\nYou currently have an active session instance connected on this account.\n\nTo reset or clear your connection, type \`/delpair\`.`, { parse_mode: 'Markdown' });
    } else {
        tgBot.sendMessage(chatId, `🚫 *NO ACTIVE PAIRS* 🚫\n\nYou don't have any saved multi-device session files. Type \`/connect\` to pair your WhatsApp now.`, { parse_mode: 'Markdown' });
    }
});

// --- DELPAIR COMMAND ---
tgBot.onText(/\/delpair/, (msg) => {
    const chatId = msg.chat.id;
    const sessionPath = `sessions/${chatId}`;

    if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        tgBot.sendMessage(chatId, `🗑️ *SESSION DELETED* 🗑️\n\nYour active pairing files have been wiped successfully. Your WhatsApp session is now disconnected.`, { parse_mode: 'Markdown' });
    } else {
        tgBot.sendMessage(chatId, `❌ No active session data found to delete.`, { parse_mode: 'Markdown' });
    }
});
