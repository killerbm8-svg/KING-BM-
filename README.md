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
