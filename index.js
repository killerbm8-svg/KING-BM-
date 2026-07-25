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
const { Boom } = require('@hapi/boom');

const app = express();
const port = process.env.PORT || 3000;

const activeSessions = {};
const sessionsDir = path.join(__dirname, 'sessions');

if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
}

app.get('/', (req, res) => {
    const targetPhone = req.query.phone ? req.query.phone.replace(/[^0-9]/g, '') : null;
    let qrBox = `<p style="color:#94a3b8; font-size: 14px; margin: 40px 10px;">Enter a phone number on the right to load its distinct live visual QR streaming array.</p>`;
    let codeDisplay = "No text code generated yet.";
    let statusLabel = targetPhone && activeSessions[targetPhone] ? activeSessions[targetPhone].status : "Idle / Disconnected";

    if (targetPhone && activeSessions[targetPhone]) {
        const session = activeSessions[targetPhone];
        if (session.qrUrl) {
            qrBox = `<img src="${session.qrUrl}" alt="Scan Live Dynamic QR Matrix" style="width:220px; height:220px; display:block; margin: 0 auto;"/>`;
        } else if (session.status === "Connected") {
            qrBox = `<div style="padding: 40px 10px;"><h3 style="color:#22c55e; margin:0;">Session Connected! 🎉</h3><p style="color:#94a3b8; font-size:12px; margin-top:5px;">Your bot is online.</p></div>`;
        } else {
            qrBox = `<div style="padding: 60px 10px; color:#38bdf8; font-size:14px;">Streaming login session keys...<br><span style="color:#64748b; font-size:12px;">Refresh page in a moment if it doesn't auto-update.</span></div>`;
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
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #0f172a; color: #f8fafc; text-align: center; padding: 40px 20px; margin: 0; }
            .container { display: flex; justify-content: center; gap: 30px; margin: 25px auto; max-width: 900px; flex-wrap: wrap; }
            .box { background-color: #1e293b; padding: 25px; border-radius: 12px; width: 360px; min-height: 320px; border: 1px solid #334155; box-shadow: 0 4px 15px rgba(0,0,0,0.3); display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box; }
            input[type="text"] { width: 85%; padding: 12px; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: #fff; text-align: center; margin-bottom: 15px; font-size: 16px; font-weight: bold; letter-spacing: 1px; }
            button { background-color: #2563eb; color: white; border: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s; font-size: 15px; width: 92%; margin: 0 auto; }
            button:hover { background-color: #1d4ed8; }
            .badge { background: #334155; padding: 4px 10px; border-radius: 20px; font-size: 13px; font-weight: bold; color: #cbd5e1; }
            .code-container { background:#020617; padding:15px; margin-top:20px; border-radius:8px; font-size:24px; font-family:monospace; font-weight:bold; color:#22c55e; border: 1px dashed #16a34a; letter-spacing: 2px; }
        </style>
    </head>
    <body>
        <h1>👑 KING-BM PUBLIC AUTOMATION CLUSTER</h1>
        <p>Target Number Context: <span class="badge">${targetPhone ? '+' + targetPhone : 'None'}</span> | Status: <strong style="color:#38bdf8">${statusLabel}</strong></p>
        
        <div class="container">
            <div class="box">
                <h3 style="margin-top:0;">Option 1: Scan QR Code</h3>
                <div style="background:white; padding:15px; border-radius:8px; display:inline-block; margin: 10px auto; width: fit-content; min-width:220px; min-height:220px;">
                    ${qrBox}
                </div>
                <p style="font-size:12px; color:#94a3b8; margin-bottom:0;">Visual web synchronization layout</p>
            </div>
            <div class="box">
                <h3 style="margin-top:0;">Option 2: Get Pairing Code</h3>
                <form action="/start-session" method="GET">
                    <input type="text" name="phone" value="${targetPhone || ''}" placeholder="e.g. 254108487451" required>
                    <button type="submit">Initialize Link Request</button>
                </form>
                <div class="code-container">
                    ${codeDisplay}
                </div>
                <p style="font-size:12px; color:#94a3b8; margin-bottom:0;">Direct 8-digit text configuration</p>
            </div>
        </div>
        <br>
        <button style="width:auto;" onclick="window.location.reload()">🔄 Force Update Screen State</button>
    </body>
    </html>
    `);
});

app.get('/start-session', async (req, res) => {
    let rawPhone = req.query.phone;
    if (!rawPhone) return res.redirect('/');
    const cleanedNumber = rawPhone.replace(/[^0-9]/g, '');
    startUserSession(cleanedNumber);
    res.send(`
        <div style="background:#0f172a; color:#fff; height:100vh; display:flex; justify-content:center; align-items:center; font-family:sans-serif; text-align:center; flex-direction:column;">
            <h2>Initializing secure authentication streams for +${cleanedNumber}...</h2>
            <script>
                setTimeout(() => { window.location.href = '/?phone=${cleanedNumber}'; }, 5000);
            </script>
        </div>
    `);
});

async function startUserSession(phoneNumber) {
    if (activeSessions[phoneNumber]) {
        if (activeSessions[phoneNumber].status === "Connected") return;
        try { activeSessions[phoneNumber].sock.end(); } catch(e) {}
    }

    const userAuthPath = path.join(sessionsDir, phoneNumber);
    const { state, saveCreds } = await useMultiFileAuthState(userAuthPath);
    const { version } = await fetchLatestBaileysVersion();

    activeSessions[phoneNumber] = {
        status: "Connecting...",
        pairingCode: "GENERATING...",
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

    setTimeout(async () => {
        try {
            if (activeSessions[phoneNumber] && !sock.authState.creds.registered) {
                const code = await sock.requestPairingCode(phoneNumber);
                if (activeSessions[phoneNumber]) {
                    activeSessions[phoneNumber].pairingCode = code;
                }
            }
        } catch (err) {
            if (activeSessions[phoneNumber]) activeSessions[phoneNumber].pairingCode = "REFUSED";
        }
    }, 3500);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (!activeSessions[phoneNumber]) return;

        if (qr) {
            try {
                activeSessions[phoneNumber].qrUrl = await QRCode.toDataURL(qr);
                activeSessions[phoneNumber].status = "QR Code Ready";
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
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

app.listen(port, () => {
    console.log(`Multi-session router active on port ${port}`);
});
