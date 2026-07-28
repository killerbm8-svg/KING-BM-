const { makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const TelegramBot = require('node-telegram-bot-api');
const pino = require('pino');

// Read directly from the cloud environment configuration panel
const tgToken = process.env.TELEGRAM_BOT_TOKEN;
const botName = process.env.BOT_NAME || "KING-BM-";
const prefix = process.env.PREFIX || "/";

if (!tgToken) {
    console.error("❌ ERROR: TELEGRAM_BOT_TOKEN is missing! Please add it to your hosting platform's Environment Variables settings.");
    process.exit(1);
}

// 1. Initialize Telegram Menu Interface Handler
const tgBot = new TelegramBot(tgToken, { polling: true });
console.log(`🤖 Telegram Interface active for ${botName}`);

// Handle the /start command to display the exact styled layout seen in your screenshot
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

_*POWERED BY KILLERBM8-SVG*_`;

    const options = {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '👥 SUPPORT GROUP', url: 'https://t.me' },
                    { text: '💻 REPOSITORY', url: 'https://github.com' }
                ]
            ]
        }
    };
    tgBot.sendMessage(chatId, welcomeMenu, options);
});

// Handle the pairing requests workflow 
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
            
            // Initialize Baileys Multi-Device Engine
            const { state, saveCreds } = await useMultiFileAuthState(`sessions/${chatId}`);
            const sock = makeWASocket({
                auth: state,
                logger: pino({ level: 'silent' }),
                printQRInTerminal: false
            });

            sock.ev.on('creds.update', saveCreds);

            setTimeout(async () => {
                try {
                    let code = await sock.requestPairingCode(rawNumber); 
                    code = code?.match(/.{1,4}/g)?.join('-') || code; 
                    
                    const responseText = `✨ *PAIRING REPLICA INSTANCE* ✨\n\nYour deployment multi-device verification token is:\n\`${code}\`\n\n*Instructions:*\n1. Open WhatsApp on your phone.\n2. Tap *Linked Devices* ➜ *Link a Device*.\n3. Choose *Link with phone number instead*.\n4. Input the code displayed above.`;
                    tgBot.sendMessage(chatId, responseText, { parse_mode: 'Markdown' });
                } catch (err) {
                    tgBot.sendMessage(chatId, `❌ Code requests closed: ${err.message}`);
                }
            }, 3000);

        } catch (error) {
            tgBot.sendMessage(chatId, `❌ Failed to initialize pairing instance: ${error.message}`);
        }
    });
});
