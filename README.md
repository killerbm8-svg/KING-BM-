# 👑 KING 🤴 BM — Multi-Device WhatsApp Bot Platform

Welcome to **KING 🤴 BM**, a powerful, modern, multi-session WhatsApp automation platform built with Node.js and the robust `@whiskeysockets/baileys` library. This platform allows multiple users to connect their unique WhatsApp accounts concurrently using lightweight pairing codes, opening up a world of seamless automated management, protection, and group utility.

---

## 🚀 Key Features

*   **⚡ Isolated Multi-Session Manager**: Hosts multiple independent WhatsApp accounts simultaneously without resource conflicts or cross-talk.
*   **🔑 8-Digit Code Pairing**: No camera or QR code scans required. Users simply input their phone number on the web dashboard to instantly generate a secure 8-character linking string.
*   **🛡️ Active Anti-Link Security Engine**: Automatically monitors group chats, instantly deletes forbidden invite links, warns malicious senders, and removes non-admin offenders.
*   **👁️ Auto Status Automations**: Automatically views contact statuses (`autoViewStatus`) and reacts with configurable emojis (`autoReactStatus`) in real-time.
*   **📊 Unified Command Core**: Built-in native utility features including responsive diagnostics (`.ping`), group metrics (`.groupinfo`), and a main dashboard menu (`.menu`).

---

## 🛠️ Built-With Stack

*   **Runtime Engine**: Node.js (v18+)
*   **API Framework**: Express.js
*   **WhatsApp Bridge Protocol**: @whiskeysockets/baileys
*   **Relational Database Memory**: PostgreSQL

---
### **Step 1: Get Session ID**
Click the button below to quickly generate your WhatsApp session ID:

<p align="center">
  <a href="https://spoiler-bm.onrender.com" target="_blank">
    <img src="https://img.shields.io/badge/🔑_GET_SESSION-000000?style=for-the-badge&color=FF0000" width="260" height="50"/>
  </a>
</p>

### **Step 3: Choose Hosting Platform**
Deploy the bot on your preferred platform.

<p align="center">
   <a href="https://spoiler-bm.onrender.com" target="_blank">
    <img src="https://img.shields.io/badge/🚀_HEROKU-000000?style=for-the-badge&color=FF00FF" width="200" height="45"/>
  </a>
  <a href="https://spoiler-bm.onrender.com" target="_blank">
    <img src="https://img.shields.io/badge/🚀_RENDER-000000?style=for-the-badge&color=61DAFB" width="200" height="45"/>
  </a>
  <a href="https://railway.app?referralCode=AqkNn4" target="_blank">
    <img src="https://img.shields.io/badge/🚀_RAILWAY-000000?style=for-the-badge&color=purple" width="200" height="45"/>
  </a>
</p>

### **Step 2: Configure Settings**
Before deployment, configure your bot:
- **Option A:** Edit `config.env` file
- **Option B:** Use environment variables on your 

## ⚙️ Direct Deployment Guide

This platform is fully optimized for single-click, seamless zero-downtime deployment on cloud architecture platforms like **Render**, **Railway**, or **Koyeb**.

### 1. Database Setup
1. Spin up a free managed **PostgreSQL Database** on [Neon.tech](https://neon.tech) or [Supabase](https://supabase.com).
2. Copy your unique `postgres://...` connection string.

### 2. Environment Variables Configuration
When launching your server instance, configure the following critical environment variables under your cloud host's settings panel:

| Key | Description | Example Value |
| :--- | :--- | :--- |
| `DATABASE_URL` | Your secure PostgreSQL external connection string | `postgres://user:pass@host:5432/db` |
| `PORT` | The network communication port for your Express web server | `3000` |

### 3. Launch & Pair
1. Connect your personal GitHub fork of this repository to your web service host.
2. Trigger the build sequence. Once compilation finishes, navigate to your public web application URL.
3. Provide your phone number formatted with your active international country code (e.g., `2547XXXXXXXX`) to fetch your dynamic linkage token.

---

## 📜 Available Chat Commands

| Command | Action / Response Trigger | Target Scope |
| :--- | :--- | :--- |
| `.menu` / `.help` | Displays the status of active features and lists operational commands. | Public & Private |
| `.ping` | Runs a system ping to test latency and platform responsiveness. | Public & Private |
| `.groupinfo` | Displays live group statistics, participant metrics, and subject titles. | Group Chats Only |

## 📢 **Stay Updated**

<p align="center">
  <a href="https://whatsapp.com/channel/0029VbChWLcCRs1nIoOoyk2T" target="_blank">
    <img src="https://img.shields.io/badge/📢_WHATSAPP_CHANNEL-25d366?style=for-the-badge&logo=whatsapp" width="300" height="50"/>
  </a>
  <br>
  <a href="https://chat.whatsapp.com/HFkhRciXPv60qkmcKGIX3w?s=cl&p=a&mlu=0&ilr=0&amv=1" target="_blank">
    <img src="https://img.shields.io/badge/📢_WHATSAPP_GROUP-25d366?style=for-the-badge&logo=whatsapp" width="300" height="50"/>
  </a>
  <br>
  <a href="https://t.me/+3GVymuRshyw1ZDQ0" target="_blank">
    <img src="https://img.shields.io/badge/📢_TELEGRAM_CHANNEL-25d366?style=for-the-badge&logo=whatsapp" width="300" height="50"/>
  </a>
  <br>

## 📊 **Stats**

<p align="center">
  <img src="https://komarev.com/ghpvc/?username=Bwmxmd254&label=Profile+Views&color=FF0000&style=for-the-badge" alt="Views"/>
  <img src="https://img.shields.io/github/followers/Bwmxmd254?label=GitHub+Followers&style=for-the-badge&color=00FF00" alt="Followers"/>
</p>

---

## 🟢 **Status**

<p align="center">
  <img src="https://raw.githubusercontent.com/Bwmxmd254/Bwmxmd254/main/assets/statusbar.gif" height="25">
  <br>
  <span style="font-size:1.2em; color:#00FF00;">Status: <b>🟢 ONLINE</b></span>
</p>

---

<!-- Footer -->
<p align="center">
  <img src="https://i.imgur.com/dBaSKWF.gif" height="40" width="100%">
</p>

<p align="center">
  <strong>BWM XMD PRO © 2026 | Developed by Ibrahim Adams</strong>
</p>
