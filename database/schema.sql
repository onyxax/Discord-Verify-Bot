CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Guild configuration table
CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id TEXT PRIMARY KEY,
    control_channel_id TEXT,
    public_verify_channel_id TEXT,
    verified_role_id TEXT,
    unverified_role_id TEXT,
    security_level TEXT NOT NULL DEFAULT 'dual-layer'
        CHECK (security_level IN ('image-captcha', 'hcaptcha', 'dual-layer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guild_settings_guild_id ON guild_settings(guild_id);

-- Active verification sessions
CREATE TABLE IF NOT EXISTS active_sessions (
    token TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(32), 'hex'),
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    guild_name TEXT NOT NULL DEFAULT '',
    captcha_text TEXT,
    hcaptcha_passed BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'verified', 'expired')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes')
);

CREATE INDEX IF NOT EXISTS idx_active_sessions_token ON active_sessions(token);
CREATE INDEX IF NOT EXISTS idx_active_sessions_user_guild ON active_sessions(user_id, guild_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_expires ON active_sessions(expires_at) WHERE status = 'pending';

-- Row-Level Security
ALTER TABLE guild_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on guild_settings"
    ON guild_settings FOR ALL
    TO service_role
    USING (true);

CREATE POLICY "Service role full access on active_sessions"
    ON active_sessions FOR ALL
    TO service_role
    USING (true);
