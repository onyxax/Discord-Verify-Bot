import { getGuildSettings } from '../utils/supabase.js';

export async function handleGuildMemberAdd(client, member) {
  try {
    if (member.user.bot) return;

    const guildSettings = await getGuildSettings(member.guild.id);
    if (!guildSettings || !guildSettings.unverified_role_id) return;

    const role = member.guild.roles.cache.get(guildSettings.unverified_role_id);
    if (!role) return;

    const botMember = member.guild.members.cache.get(client.user.id);
    if (botMember && botMember.roles.highest.position <= role.position) return;

    await member.roles.add(role, 'Verify Hydra - New member quarantine');
  } catch (error) {
    console.error(`[Verify Hydra] Failed to assign unverified role:`, error.message);
  }
}
