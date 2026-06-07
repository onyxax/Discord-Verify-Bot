# Verify Hydra

Decentralized Discord verification microservice. Pull-based architecture using Discord.js, Cloudflare Workers, and Supabase PostgreSQL.

## Architecture

```
Discord User
    |
    v
[Discord Bot] --POST--> [Cloudflare Worker] --INSERT--> [Supabase DB]
    ^                           |
    |                           v
    |                    [Verification Page]
    |                           |
    |                           v
    +----Poll (every 3s)--------+
```

| Component | Location | Purpose |
|-----------|----------|---------|
| Discord Bot | `/bot` | Guild setup, interaction handling, role assignment |
| Cloudflare Worker | `/worker` | Edge API, token generation, captcha verification |
| Database | `/database` | Supabase PostgreSQL schema |

## Features

- Dual-layer captcha (hCaptcha + image captcha)
- Pull-based architecture (no callback server)
- Matte Black/White UI design
- Role hierarchy safety checks
- Token-based session management (5-minute expiry)
- Single-file Cloudflare Worker deployment

## Prerequisites

- Node.js >= 18
- Discord Bot token ([Developer Portal](https://discord.com/developers/applications))
- Cloudflare account ([Cloudflare Dashboard](https://dash.cloudflare.com))
- Supabase project ([Supabase Dashboard](https://supabase.com/dashboard))

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/Nexus-02/verify-hydra.git
cd verify-hydra
npm install
```

### 2. Database

Run `database/schema.sql` in the **Supabase SQL Editor** to create the required tables.

### 3. Cloudflare Worker

```bash
cd worker
npm install
npx wrangler login
npx wrangler secret put HCAPTCHA_SECRET
npx wrangler secret put INTERNAL_API_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler deploy
```

Update `wrangler.toml` with your values:

```toml
[vars]
SUPABASE_URL = "https://your-project.supabase.co"
HCAPTCHA_SITEKEY = "your-hcaptcha-sitekey"
FRONTEND_BASE_URL = "https://your-worker.workers.dev"
```

### 4. Discord Bot

```bash
cd bot
cp .env.example .env
# Fill in all values in .env
npm install
npm start
```

### 5. Discord Server Setup

1. Bot creates a `verify-hydra-control` channel on join
2. Select: verification channel, verified role, quarantine role, security level
3. Click **Save and Initialize** — the verification prompt is posted automatically

## Environment Variables

### Bot (`bot/.env`)

| Variable | Description |
|----------|-------------|
| `DISCORD_TOKEN` | Bot token from Developer Portal |
| `DISCORD_CLIENT_ID` | Bot application client ID |
| `HYDRA_WORKER_URL` | Deployed worker URL |
| `INTERNAL_API_KEY` | Shared secret (must match worker) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |

### Worker (Cloudflare Secrets / `wrangler.toml`)

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `INTERNAL_API_KEY` | Shared secret (must match bot) |
| `HCAPTCHA_SITEKEY` | hCaptcha site key (public) |
| `HCAPTCHA_SECRET` | hCaptcha secret key |
| `FRONTEND_BASE_URL` | Worker public URL |

## Security Levels

| Level | Description |
|-------|-------------|
| `image-captcha` | SVG captcha text challenge |
| `hcaptcha` | hCaptcha widget only |
| `dual-layer` | hCaptcha + image captcha (recommended) |

## License

[MIT](LICENSE)
