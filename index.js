const express = require('express');
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// Global memory map keeping track of individual live user pairing tracks
const activeSessions = {};

// Clean folder allocation layout to prevent hard crashes
const sessionsDir = path.join(__dirname, 'sessions');
if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
}

// Global Main UI Hub Router
app.get('/', (req, res) => {
    const targetPhone = req.query.phone ? req.query.phone.replace(/[^0-9]/g, '') : null;
    
    let qrBox = `<p style="color:#64748b;">Enter a phone number on the right to load its distinct visual stream pairing array.</p>`;
    let codeDisplay = "No text code generated yet.";
    let statusLabel = targetPhone && activeSessions[targetPhone] ? activeSessions[targetPhone].status : "Idle / Disconnected";

    if (targetPhone && activeSessions[targetPhone]) {
        const session = activeSessions[targetPhone];
        if (session.qrUrl) {
            qrBox = `<img src="${session.qrUrl}" alt="Scan Live Dynamic QR Matrix" style="width:220px; height:220px; display:block;"/>`;
        } else if (session.status === "Connected") {
            qrBox = `<h3 style="color:#22c55e;">Session Connected! 🎉</h3>`;
        } else {
            qrBox = `<p style="color:#e2e8f0;">Processing socket loop streams...</p>`;
        }
        codeDisplay = session.pairingCode || codeDisplay;
    }

    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>KING-BM Scalable Multi-Session Core</title>
        <style>
            body { font-family: sans-serif; background-color: #0f172a; color: #f8fafc; text-align: center; padding: 40px 20px; margin: 0; }
            .container { display: flex; justify-content: center; gap: 30px; margin: 25px auto; max-width: 900px; flex-wrap: wrap; }
            .box { background-color: #1e293b; padding: 25px; border-radius: 12px; width: 360px; min-height: 280px; border: 1px solid #334155; box-shadow: 0 4px 15px rgba(0,0,0,0.3); }
            input[type="text"] { width: 80%; padding: 12px; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: #fff; text-align: center; margin-bottom: 15px; font-size: 15px; }
            button { background-color: #2563eb; color: white; border: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s; }
            button:hover { background-color: #1d4ed8; }
            .badge { background: #334155; padding: 4px 10px; border-radius: 20px; font-size: 13px; font-weight: bold; color: #cbd5e1; }
        </style>
    </head>
    <body>
        <h1>👑 KING-BM PUBLIC AUTOMATION CLUSTER</h1>
        <p>Current target input context: <span class="badge">${targetPhone ? '+' + targetPhone : 'None selected'}</span> | Status: <strong style="color:#38bdf8">${statusLabel}</strong></p>
        
        <div class="container">
            <!-- Left Side Element: Isolated Instant QR Matrix Engine Layout -->
            <div class="box">
                <h3>Option 1: Scan QR Code</h3>
                <div style="background:white; padding:15px; border-radius:8px; display:inline-block; margin: 10px 0;">${qrBox}</div>
                <p style="font-size:12px; color:#94a3b8;">Refreshes on screen automatically inside active streams</p>
            </div>

            <!-- Right Side Element: Dynamic Dedicated Multi-Device Text Token Engine -->
            <div class="box">
                <h3>Option 2: Get Pairing Code</h3>
                <form action="/" method="GET">
                    <input type="text" name="phone" value="${targetPhone || ''}" placeholder="e.g. 254712345678" required>
                    <button type="submit">Initialize Link Request</button>
                </form>
                <div style="background:#020617; padding:15px; margin-top:20px; border-radius:8px; font-size:24px; font-family:monospace; font-weight:bold; color:#22c55e; border: 1px dashed #16a34a;">
                    ${codeDisplay}
                </div>
            </div>
        </div>
        <br>
        <button onclick="window.location.reload()">🔄 Force Sync Dashboard State</button>
    </body>
    </html>
    `);
});

// Master background execution engine orchestrating distinct login tunnels
async function startUserSession(phoneNumber) {
    // If user mapping sequence is already active, safely drop thread loops to refresh tracking links
    if (activeSessions[phoneNumber] && activeSessions[phoneNumber].sock) {
        if (activeSessions[phoneNumber].status === "Connected") return; // Keep established links alive
        try { activeSessions[phoneNumber].sock.end(); } catch(e) {}
    }

    // Allocate an isolated file sub-directory for this explicit number path block
    const userAuthPath = path.join(sessionsDir, phoneNumber);
    const { state, saveCreds } = await useMultiFileAuthState(userAuthPath);
    const { version } = await fetchLatestBaileysVersion();

    activeSessions[phoneNumber] = {
        status: "Connecting",
        pairingCode: "FETCHING...",
        qrUrl: "",
        sock: null
    };

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    activeSessions[phoneNumber].sock = sock;

    // Immediately trigger individual E.164 text generation loop tracks
    setTimeout(async () => {
        try {
            if (!sock.authState.creds.registered) {
                const code = await sock.requestPairingCode(phoneNumber);
                if (activeSessions[phoneNumber]) {
                    activeSessions[phoneNumber].pairingCode = code;
                }
            }
        } catch (err) {
            if (activeSessions[phoneNumber]) activeSessions[phoneNumber].pairingCode = "TRY AGAIN";
        }
    }, 4500);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (activeSessions[phoneNumber]) {
            if (qr) {
                try {
                    activeSessions[phoneNumber].qrUrl = await QRCode.toDataURL(qr);
                } catch(e) {}
            }

            if (connection === 'close') {
                activeSessions[phoneNumber].status = "Disconnected";
                activeSessions[phoneNumber].qrUrl = "";
                const shouldReconnect = (lastDisconnect?.error instanceof Boom) 
                    ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut 
                    : true;
                if (shouldReconnect) {
                    startUserSession(phoneNumber);
                } else {
                    delete activeSessions[phoneNumber];
                }
            } else if (connection === 'open') {
                activeSessions[phoneNumber].status = "Connected";
                activeSessions[phoneNumber].pairingCode = "CONNECTED ✅";
                activeSessions[phoneNumber].qrUrl = "";
                console.log(`[SUCCESS] User +${phoneNumber} linked successfully.`);
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Dynamic Multi-Session Global Command Handling Event Loop
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const from = msg.key.remoteJid;

        if (text.toLowerCase() === '.ping') {
            await sock.sendMessage(from, { text: 'Pong! 👑 KING-BM system cluster online.' }, { quoted: msg });
        }
    });
}

// Hook route middleware triggering initialization requests instantly upon submission layout shifts
app.use((req, res, next) => {
    if (req.query.phone) {
        const cleanNum = req.query.phone.replace(/[^0-9]/g, '');
        if (cleanNum && (!activeSessions[cleanNum] || activeSessions[cleanNum].status === "Disconnected")) {
            startUserSession(cleanNum).catch(console.error);
        }
    }
    next();
});

app.listen(port, () => {
    console.log(`Multi-session cluster router listening via interface layer targets on port ${port}`);
});
