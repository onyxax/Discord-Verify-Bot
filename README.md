<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/icon.svg">
  <source media="(prefers-color-scheme: light)" srcset="assets/icon.svg">
  <img alt="Verify Hydra" src="assets/icon.svg" width="140" style="margin: 20px 0; border-radius: 28px;">
</picture>

# Verify Hydra

### <img src="https://api.iconify.design/lucide:shield-check.svg?color=%235865f2" width="22" align="absmiddle"> Next-Generation Discord Verification System

**Enterprise-grade security. Decentralized architecture. Zero callback servers.**

[![MIT License](https://img.shields.io/badge/License-MIT-emerald?style=for-the-badge&labelColor=1a1a1a)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-2ea44f?style=for-the-badge&labelColor=1a1a1a&logo=node.js&logoColor=white)](https://nodejs.org)
[![Discord.js](https://img.shields.io/badge/Discord.js-v14-5865F2?style=for-the-badge&labelColor=1a1a1a&logo=discord&logoColor=white)](https://discord.js.org)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=for-the-badge&labelColor=1a1a1a&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-via%20Supabase-336791?style=for-the-badge&labelColor=1a1a1a&logo=postgresql&logoColor=white)](https://supabase.com)

---

</div>

## <img src="https://api.iconify.design/lucide:list.svg?color=%235865f2" width="22" align="absmiddle"> Table of Contents

- [Overview](#-overview)
- [Why Verify Hydra?](#-why-verify-hydra)
- [Architecture](#-architecture)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Security](#-security)
- [Commands](#-commands)
- [Advanced](#-advanced)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

---

## <img src="https://api.iconify.design/lucide:info.svg?color=%235865f2" width="22" align="absmiddle"> Overview

**Verify Hydra** is a sophisticated, open-source Discord verification bot that protects your server from alt accounts, VPNs, and malicious bots using a **revolutionary pull-based architecture**.

Unlike traditional verification systems that require incoming HTTP traffic and complex callback servers, Verify Hydra operates with **zero exposed endpoints** — the bot simply polls a Supabase database for verification status, making it:

<img src="https://api.iconify.design/lucide:file-text.svg?color=%235865f2" width="18" align="absmiddle"> **Simple to Deploy** — No port forwarding, no firewalls, no Docker headaches  
<img src="https://api.iconify.design/lucide:zap.svg?color=%235865f2" width="18" align="absmiddle"> **Impossible to DDoS** — No callback servers to attack  
<img src="https://api.iconify.design/lucide:lock.svg?color=%235865f2" width="18" align="absmiddle"> **Cryptographically Secure** — Token-based verification with expiry  
<img src="https://api.iconify.design/lucide:layers.svg?color=%235865f2" width="18" align="absmiddle"> **Scalable** — One instance, unlimited servers  

---

## <img src="https://api.iconify.design/lucide:star.svg?color=%235865f2" width="22" align="absmiddle"> Why Verify Hydra?

| Problem | Traditional Solution | Verify Hydra |
|---------|---------------------|--------------|
| **Incoming Traffic** | Requires Express server + firewall rules | Zero incoming connections |
| **Complexity** | Multiple services to manage | Single worker + database polling |
| **Reliability** | Bot crashes = verification breaks | Database always accessible |
| **Scaling** | Multiple bot instances per server | One bot, infinite servers |
| **Security** | Exposed HTTP endpoints | Fully internal, pull-only architecture |
| **Maintenance** | Callbacks, webhooks, error handling | Fire and forget |

---

## <img src="https://api.iconify.design/lucide:workflow.svg?color=%235865f2" width="22" align="absmiddle"> Architecture

```
┌─────────────┐          ┌──────────────┐          ┌────────────────┐
│   Discord   │          │   Supabase   │          │   Cloudflare   │
│     Bot     │◄────────►│  PostgreSQL  │◄────────►│     Worker     │
└─────────────┘  polls   └──────────────┘  reads   └────────────────┘
       │                        │                        │
       │ role assignment        │ token storage          │ captcha page
       │ every 3 seconds        │ session status         │ edge-hosted
       ▼                        ▼                        ▼
   Your Guild              Your Database            Global Network
```

### Verification Flow Sequence

```
User joins → Bot auto-quarantines → User clicks link → Solves captcha → Worker updates DB → Bot polls → Role assigned
   [0s]            [1s]                [5s]              [10s]              [12s]          [15s]        [18s]
```

| Step | Component | Action | Time |
|------|-----------|--------|------|
| 1 | **Bot** | Generates secure token, sends link to user | `0s` |
| 2 | **Worker** | Creates verification session in Supabase | `1s` |
| 3 | **User** | Opens link, solves captcha | `5-10s` |
| 4 | **Worker** | Marks session as verified in database | `10s` |
| 5 | **Bot** | Detects change via polling, assigns role | `15s` |
| ✓ | **User** | Gets full server access | `18s` |

**Key Innovation:** No callback from worker to bot. Zero incoming HTTP traffic. Maximum security.

---

## <img src="https://api.iconify.design/lucide:sparkles.svg?color=%235865f2" width="22" align="absmiddle"> Features

### <img src="https://api.iconify.design/lucide:shield-check.svg?color=%235865f2" width="20" align="absmiddle"> Security
- **Dual-Layer Captcha** — hCaptcha + SVG image verification for maximum protection
- **Token Expiry** — Verification links auto-expire in 5 minutes
- **Role Hierarchy Safety** — Bot validates permission hierarchy before assigning roles
- **Anti-Bypass** — New members auto-quarantine on join
- **Cryptographic Tokens** — Unpredictable, secure verification tokens

### <img src="https://api.iconify.design/lucide:zap.svg?color=%235865f2" width="20" align="absmiddle"> Performance & Scale
- **Edge-Hosted Captcha** — Cloudflare global CDN for <100ms response times
- **Pull Architecture** — Zero incoming connections, no DDoS surface
- **Multi-Server** — One bot instance handles unlimited servers simultaneously
- **Zero Dependencies** — Worker uses only native `fetch()`, no npm bloat
- **Instant Deployment** — Deploy to production in seconds

### <img src="https://api.iconify.design/lucide:sliders.svg?color=%235865f2" width="20" align="absmiddle"> Configuration
- **Slash Commands** — Modern Discord UI with `/panel` and `/setup`
- **Per-Server Config** — Different roles and settings per guild
- **Flexible Security Levels** — Choose your captcha intensity
- **Customizable Pages** — Edit verification UI directly in worker code
- **Auto-Setup** — Control panel creates itself when bot joins

### <img src="https://api.iconify.design/lucide:user-check.svg?color=%235865f2" width="20" align="absmiddle"> User Experience
- **Obsidian UI** — Beautiful dark/light theme with Components V2
- **Fast Verification** — Complete process in <20 seconds
- **Clear Feedback** — Real-time status updates
- **Mobile Friendly** — Works perfectly on all devices
- **Accessibility** — WCAG compliant, keyboard navigable

---

## <img src="https://api.iconify.design/lucide:cpu.svg?color=%235865f2" width="22" align="absmiddle"> Tech Stack

| Layer | Technology | Purpose | Why? |
|-------|-----------|---------|------|
| **Bot** | Node.js 18+ | Discord integration | Lightweight, fast |
| **Bot Framework** | Discord.js v14 | Bot interactions | Latest & most reliable |
| **Backend** | Cloudflare Workers | Verification page | Edge-fast, serverless |
| **Database** | Supabase (PostgreSQL) | Data persistence | Open-source, reliable |
| **Captcha** | hCaptcha + SVG | Human verification | Privacy-first dual layer |
| **Deployment** | Wrangler CLI | Worker deployment | Simple one-command deploy |

---

## <img src="https://api.iconify.design/lucide:download.svg?color=%235865f2" width="22" align="absmiddle"> Installation

### Prerequisites

Before you begin, make sure you have:

```
✓ Node.js 18+ installed
✓ npm or yarn package manager
✓ A Discord bot token (from Discord Developer Portal)
✓ A Supabase account (free tier works)
✓ A Cloudflare account (free tier works)
✓ An hCaptcha account (free tier works)
```

### Step 1 — Clone Repository

```bash
git clone https://github.com/onyxax/VerifyHydra.git
cd VerifyHydra
npm install
```

### Step 2 — Database Setup

#### Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Copy your **Project URL** and **Service Role Key**

#### Initialize Database

Open Supabase SQL Editor and run `database/schema.sql`:

```bash
# OR use Supabase CLI
supabase db push
```

**Tables Created:**
- `guild_settings` — Server configuration & roles
- `active_sessions` — Verification tokens & status

### Step 3 — Cloudflare Worker Setup

```bash
cd worker
npx wrangler login
```

#### Set Secrets

```bash
# This will prompt you to paste — use a random string
npx wrangler secret put INTERNAL_API_KEY
# Generate: openssl rand -base64 32

npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# Copy from Supabase dashboard

npx wrangler secret put HCAPTCHA_SECRET
# From hCaptcha dashboard
```

#### Configure wrangler.toml

```toml
name = "VerifyHydra"
main = "index.js"
compatibility_date = "2026-06-07"

[env.production]
name = "VerifyHydra-prod"

[vars]
SUPABASE_URL = "https://your-project.supabase.co"
HCAPTCHA_SITEKEY = "your-sitekey"
FRONTEND_BASE_URL = "https://verifyhydra.your-domain.workers.dev"
ENVIRONMENT = "production"
```

#### Deploy Worker

```bash
npx wrangler deploy
# Output: ✓ Uploaded VerifyHydra (1.23 sec)
#   -> https://verifyhydra.your-domain.workers.dev
```

**Copy your worker URL** — you'll need it for the bot.

### Step 4 — Discord Bot Setup

```bash
cd ../bot
cp .env.example .env
```

#### Fill bot/.env

```env
# Discord
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here

# Verify Hydra
HYDRA_WORKER_URL=https://verifyhydra.your-domain.workers.dev
INTERNAL_API_KEY=same-key-as-worker

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-key
```

#### Register Slash Commands

```bash
node src/deploy-commands.js
# Output: ✓ Registered /panel
#         ✓ Registered /setup
```

#### Start Bot

```bash
npm start
# Bot online ✓
# Ready to verify 3 guilds
```

---

## <img src="https://api.iconify.design/lucide:sliders.svg?color=%235865f2" width="22" align="absmiddle"> Configuration

### Automatic Setup

When your bot joins a server, it **automatically creates a control panel** with all configuration options.

### Manual Setup Command

```
/setup
  channel: #verify
  verified_role: @Verified
  quarantine_role: @Unverified
  security: dual-layer
```

### Configuration Panel

Use the interactive `/panel` command:

```
/panel
```

Access: **Server Administrator only**

---

## <img src="https://api.iconify.design/lucide:shield-check.svg?color=%235865f2" width="22" align="absmiddle"> Security Levels

Choose your security level based on your server's needs:

| Level | Captcha Type | Bypass Difficulty | Use Case |
|-------|-------------|-------------------|----------|
| `image-captcha` | SVG text only | Easy | Testing, trusted communities |
| `hcaptcha` | hCaptcha only | Hard | Most servers (recommended start) |
| `dual-layer` | hCaptcha + SVG | Very Hard | High-security servers |

### Recommended Progression

```
Small Server → image-captcha → Medium Growth → hcaptcha → High Targets → dual-layer
```

---

## <img src="https://api.iconify.design/lucide:terminal.svg?color=%235865f2" width="22" align="absmiddle"> Commands

### User Commands

| Command | Usage | Returns |
|---------|-------|---------|
| `/verify` | Opens verification | Verification link |

### Administrator Commands

| Command | Parameters | Permission | Effect |
|---------|-----------|-----------|--------|
| `/panel` | — | Administrator | Opens interactive config UI |
| `/setup` | `channel`, `verified_role`, `quarantine_role`, `security` | Administrator | Quick setup with one command |

### Developer Commands

| Command | Parameters | Permission | Effect |
|---------|-----------|-----------|--------|
| `/debug` | — | Owner only | Shows verification status |
| `/purge-sessions` | — | Owner only | Clear expired tokens |

---

## <img src="https://api.iconify.design/lucide:folder.svg?color=%235865f2" width="22" align="absmiddle"> Project Structure

```
VerifyHydra/
│
├── bot/
│   ├── src/
│   │   ├── index.js                        # Bot startup & client init
│   │   ├── deploy-commands.js              # Slash command registration
│   │   │
│   │   ├── events/
│   │   │   ├── guildCreate.js              # Control panel on join
│   │   │   ├── guildMemberAdd.js          # Auto-quarantine members
│   │   │   └── interactionCreate.js        # Handle all interactions
│   │   │
│   │   └── utils/
│   │       └── supabase.js                 # Database queries & helper
│   │
│   ├── .env.example                        # Environment template
│   └── package.json
│
├── worker/
│   ├── index.js                            # Complete backend (single file)
│   │   ├── API routes (create session, verify token, get config)
│   │   ├── Frontend (HTML/CSS for captcha page)
│   │   └── Captcha logic (hCaptcha + SVG)
│   │
│   ├── wrangler.toml                       # Deployment config
│   └── package.json
│
├── database/
│   └── schema.sql                          # PostgreSQL schema
│       ├── guild_settings table
│       └── active_sessions table
│
├── assets/
│   └── icon.svg
│
├── README.md                               # This file
└── LICENSE                                 # MIT License
```

---

## <img src="https://api.iconify.design/lucide:key.svg?color=%235865f2" width="22" align="absmiddle"> Environment Variables

### Bot (.env)

| Variable | Required | Type | Example |
|----------|----------|------|---------|
| `DISCORD_TOKEN` | Yes | String | `MzkyNz...` |
| `DISCORD_CLIENT_ID` | Yes | String | `123456789...` |
| `HYDRA_WORKER_URL` | Yes | URL | `https://verifyhydra.workers.dev` |
| `INTERNAL_API_KEY` | Yes | String | `your-32-char-secret-key` |
| `SUPABASE_URL` | Yes | URL | `https://abcd.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | String | `eyJhbGc...` |

### Worker (wrangler.toml)

**Variables** (public, visible in logs):

```toml
[vars]
SUPABASE_URL = "https://project.supabase.co"
HCAPTCHA_SITEKEY = "00000000-0000-0000-0000-000000000000"
FRONTEND_BASE_URL = "https://verifyhydra.workers.dev"
ENVIRONMENT = "production"
```

**Secrets** (encrypted, not visible):

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put INTERNAL_API_KEY
npx wrangler secret put HCAPTCHA_SECRET
```

---

## <img src="https://api.iconify.design/lucide:code.svg?color=%235865f2" width="22" align="absmiddle"> Advanced

### Custom Verification Page

Edit `worker/index.js` and modify the `HTML_TEMPLATE`:

```javascript
// Around line 150
const HTML_TEMPLATE = (sitekey, token) => `
  <!-- Customize this HTML -->
  <div class="verification-container">
    <!-- Your custom HTML here -->
  </div>
`;
```

### Multiple Servers with Different Roles

Verify Hydra supports unlimited servers with per-server configuration:

```
Server A: role1 = Verified, role2 = Unverified, security = dual-layer
Server B: role1 = Member, role2 = Quarantine, security = hcaptcha
Server C: role1 = Guest, role2 = Bot-Check, security = image-captcha
```

All managed by one bot instance.

### Database Queries

View active sessions:

```sql
SELECT * FROM active_sessions
WHERE created_at > now() - interval '5 minutes'
ORDER BY created_at DESC;
```

View server configuration:

```sql
SELECT guild_id, verified_role_id, quarantine_role_id, security_level
FROM guild_settings
WHERE active = true;
```

---

## <img src="https://api.iconify.design/lucide:help-circle.svg?color=%235865f2" width="22" align="absmiddle"> FAQ

### Can I skip hCaptcha?

**Yes.** Set security level to `image-captcha`. The SVG captcha alone works fine for smaller servers.

```
/setup security: image-captcha
```

### Can I customize the verification page?

**Absolutely.** The entire frontend lives in `worker/index.js`. Edit CSS, HTML, and layout directly. No separate frontend needed.

### Can multiple servers use one bot?

**Yes.** That's the whole point! One bot instance, unlimited servers. Each server has independent configuration.

### Why pull-based instead of webhooks?

**Security & Simplicity:**
- No incoming HTTP traffic to open firewall
- No port forwarding needed
- No DDoS surface
- Simple to debug
- Works behind any NAT

### What if the bot goes offline?

**Verification continues.** Users can still complete verification while the bot is down. When the bot comes back online, it catches up on all pending role assignments.

---

## <img src="https://api.iconify.design/lucide:alert-triangle.svg?color=%235865f2" width="22" align="absmiddle"> Troubleshooting

### Bot doesn't respond to commands

```bash
# 1. Check bot is online
# Discord sidebar, look for bot status

# 2. Check command deployment
node src/deploy-commands.js

# 3. Check permissions
# Make sure bot has slash command permissions
```

### Verification links don't work

```bash
# 1. Check worker is deployed
curl https://your-worker.workers.dev/status

# 2. Check INTERNAL_API_KEY matches
# Bot: .env
# Worker: wrangler secrets

# 3. Check Supabase connection
```

### Role not assigned after verification

```bash
# 1. Check role hierarchy
# Bot role must be above verification role in server

# 2. Check role permissions
# Bot needs "Manage Roles" permission

# 3. Check database status
SELECT * FROM active_sessions WHERE token = 'xxx';
```

---

## <img src="https://api.iconify.design/lucide:git-pull-request.svg?color=%235865f2" width="22" align="absmiddle"> Contributing

We'd love your contributions! Whether it's bug fixes, features, or documentation.

### How to Contribute

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to your branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

---

## <img src="https://api.iconify.design/lucide:file-text.svg?color=%235865f2" width="22" align="absmiddle"> License

Licensed under the **MIT License** — see [LICENSE](LICENSE) file for details.

You're free to:
- Use commercially
- Modify & fork
- Distribute
- Use privately

Just include a copy of the license and don't hold us liable.

---

<div align="center">

**Made with care. Used by thousands. Built to scale.**

</div>
