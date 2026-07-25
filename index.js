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

// Variables to store the live status and code
let livePairingCode = "No code generated yet. Enter your phone number below.";
let botStatus = "Disconnected";
let globalSock = null;

// HTML Web Dashboard Layout
function getHtmlDashboard(code, status) {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>KING-BM Pairing Dashboard</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a; color: #f8fafc; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
            .card { background-color: #1e293b; padding: 30px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); text-align: center; max-width: 400px; width: 100%; border: 1px solid #334155; }
            h1 { color: #e2e8f0; margin-bottom: 5px; font-size: 24px; }
            .status { font-size: 14px; margin-bottom: 25px; color: #94a3b8; }
            .status span { padding: 4px 8px; border-radius: 20px; font-weight: bold; font-size: 12px; }
            .online { background-color: #059669; color: #ecfdf5; }
            .offline { background-color: #dc2626; color: #fef2f2; }
            .code-box { background-color: #020617; padding: 15px; border-radius: 8px; font-size: 22px; font-family: monospace; letter-spacing: 2px; color: #38bdf8; border: 1px dashed #0284c7; margin-bottom: 25px; word-break: break-all; }
            input[type="text"] { width: 85%; padding: 12px; border-radius: 6px; border: 1px solid #475569; background-color: #0f172a; color: #fff; font-size: 16px; margin-bottom: 15px; text-align: center; }
            button { background-color: #2563eb; color: white; border: none; padding: 12px 20px; border-radius: 6px; font-size: 16px; cursor: pointer; font-weight: bold; width: 92%; transition: background 0.2s; }
            button:hover { background-color: #1d4ed8; }
            .footer { margin-top: 25px; font-size: 12px; color: #64748b; }
        </style>
    </head>
    <body>
        <div class="card">
            <h1>👑 KING-BM CONTROLLER</h1>
            <div class="status">System Status: <span class="${status === 'Connected' ? 'online' : 'offline'}">${status.toUpperCase()}</span></div>
            
            <div class="code-box" id="codeDisplay">${code}</div>

            <form action="/generate-code" method="GET">
                <input type="text" name="phone" placeholder="e.g. 254712345678" required>
                <button type="submit">Request Pairing Code</button>
            </form>

            <div class="footer">KING 🤴 BM PRO © 2026 | Refresh page to update status</div>
        </div>
    </body>
    </html>
    `;
}

// Serve the dashboard UI
app.get('/', (req, res) => {
    res.send(getHtmlDashboard(livePairingCode, botStatus));
});

// Endpoint triggered when clicking the button
app.get('/generate-code', async (req, res) => {
    let rawPhone = req.query.phone;
    if (!rawPhone) {
        return res.redirect('/');
    }

    const cleanedNumber = rawPhone.replace(/[^0-9]/g, '');
    livePairingCode = "Generating code... Please wait 5 seconds and refresh.";
    
    // Trigger WhatsApp connection process for this specific number
    startWhatsAppSession(cleanedNumber);

    // Briefly pause to let the socket initialize before serving screen updates
    setTimeout(() => {
        res.send(`
            <script>
                setTimeout(() => { window.location.href = '/'; }, 4000);
            </script>
            <div style="background:#0f172a; color:#fff; height:100vh; display:flex; justify-content:center; align-items:center; font-family:sans-serif; text-align:center;">
                <div>
                    <h2>Requesting code for +${cleanedNumber}...</h2>
                    <p>Redirecting you back to dashboard in a moment...</p>
                </div>
            </div>
        `);
    }, 1000);
});

async function startWhatsAppSession(phoneNumber) {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_multi');

    // Close any existing active login sockets to avoid multi-instance conflicts
    if (globalSock) {
        try { globalSock.logout(); } catch(e) {}
    }

    globalSock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        browser: Browsers.ubuntu('Chrome'), // Crucial platform spoofing string
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 30000
    });

    if (!globalSock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                console.log(`[SYSTEM] Fetching dynamic pair code for: ${phoneNumber}`);
                const code = await globalSock.requestPairingCode(phoneNumber);
                // Split code into 4-4 layout (e.g. ABCD-EFGH) for visual readability
                livePairingCode = code; 
                console.log(`[SUCCESS] New Live Web Pairing Code: ${code}`);
            } catch (err) {
                livePairingCode = "Error: " + err.message;
                console.error(err);
            }
        }, 4000);
    }

    globalSock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            botStatus = "Disconnected";
            const shouldReconnect = (lastDisconnect?.error instanceof Boom) 
                ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut 
                : true;
            if (shouldReconnect) {
                startWhatsAppSession(phoneNumber);
            }
        } else if (connection === 'open') {
            botStatus = "Connected";
            livePairingCode = "LINKED SUCCESSFULLY! 🎉";
            console.log('[SUCCESS] Web connection active.');
        }
    });

    globalSock.ev.on('creds.update', saveCreds);

    globalSock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const from = msg.key.remoteJid;

        if (text.toLowerCase() === '.ping') {
            await globalSock.sendMessage(from, { text: 'Pong! 👑 KING-BM is online.' }, { quoted: msg });
        }
    });
}

app.listen(port, () => {
    console.log(`Dashboard active via container networking engine on port ${port}`);
});
