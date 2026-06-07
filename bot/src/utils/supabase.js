import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function upsertGuildSettings(settings) {
  const { data, error } = await supabase
    .from('guild_settings')
    .upsert(settings, { onConflict: 'guild_id' })
    .select()
    .single();

  if (error) throw new Error(`Supabase upsert guild_settings: ${error.message}`);
  return data;
}

export async function getGuildSettings(guildId) {
  const { data, error } = await supabase
    .from('guild_settings')
    .select('*')
    .eq('guild_id', guildId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Supabase get guild_settings: ${error.message}`);
  }
  return data;
}

export async function getPendingSession(userId, guildId) {
  const { data, error } = await supabase
    .from('active_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('guild_id', guildId)
    .eq('status', 'pending')
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Supabase get pending session: ${error.message}`);
  }
  return data;
}

export async function getVerifiedSession(userId, guildId) {
  const { data, error } = await supabase
    .from('active_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('guild_id', guildId)
    .eq('status', 'verified')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Supabase get verified session: ${error.message}`);
  }
  return data;
}
