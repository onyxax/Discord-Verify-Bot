import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  MessageFlags,
} from 'discord.js';
import { getGuildSettings, upsertGuildSettings, getPendingSession, getVerifiedSession } from '../utils/supabase.js';

const configStore = new Map();
const activePollers = new Map();

export async function handleInteractionCreate(client, interaction) {
  try {
    if (interaction.isStringSelectMenu()) {
      return handleSelectMenu(interaction);
    }

    if (interaction.isButton()) {
      return handleButton(client, interaction);
    }
  } catch (error) {
    console.error(`[Verify Hydra] Interaction error:`, error.message);

    const reply = {
      content: 'An internal error occurred. Please try again.',
      flags: [MessageFlags.Ephemeral],
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
}

async function handleSelectMenu(interaction) {
  const { customId, values, guildId } = interaction;

  if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: 'Insufficient permissions. Server Administrator required.',
      flags: [MessageFlags.Ephemeral],
    });
  }

  if (!configStore.has(guildId)) {
    configStore.set(guildId, {});
  }

  const config = configStore.get(guildId);

  if (customId === 'hydra_select_channel') {
    config.channelId = values[0];
    configStore.set(guildId, config);
    return interaction.reply({
      content: `Verification channel set to <#${values[0]}>.`,
      flags: [MessageFlags.Ephemeral],
    });
  }

  if (customId === 'hydra_select_role') {
    config.roleId = values[0];
    configStore.set(guildId, config);
    return interaction.reply({
      content: `Verified role set to <@&${values[0]}>.`,
      flags: [MessageFlags.Ephemeral],
    });
  }

  if (customId === 'hydra_select_security') {
    config.securityLevel = values[0];
    configStore.set(guildId, config);
    return interaction.reply({
      content: `Security level set to \`${values[0]}\`.`,
      flags: [MessageFlags.Ephemeral],
    });
  }

  if (customId === 'hydra_select_unverified_role') {
    config.unverifiedRoleId = values[0];
    configStore.set(guildId, config);
    return interaction.reply({
      content: `Quarantine role set to <@&${values[0]}>.`,
      flags: [MessageFlags.Ephemeral],
    });
  }
}

async function handleButton(client, interaction) {
  if (interaction.customId === 'hydra_save_config') {
    return handleSaveConfig(client, interaction);
  }

  if (interaction.customId === 'hydra_verify_button') {
    return handleVerifyButton(client, interaction);
  }
}

async function handleSaveConfig(client, interaction) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: 'Insufficient permissions. Server Administrator required.',
      flags: [MessageFlags.Ephemeral],
    });
  }

  const config = configStore.get(interaction.guildId);

  if (!config || !config.channelId || !config.roleId || !config.unverifiedRoleId || !config.securityLevel) {
    return interaction.reply({
      content:
        'Configuration incomplete. Please select all four options:\n' +
        '-> Verification Channel\n' +
        '-> Verified Role\n' +
        '-> Quarantine Role\n' +
        '-> Security Level',
      flags: [MessageFlags.Ephemeral],
    });
  }

  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

  try {
    const controlChannel = interaction.channel;

    await upsertGuildSettings({
      guild_id: interaction.guildId,
      control_channel_id: controlChannel.id,
      public_verify_channel_id: config.channelId,
      verified_role_id: config.roleId,
      unverified_role_id: config.unverifiedRoleId,
      security_level: config.securityLevel,
    });

    const verifyChannel = interaction.guild.channels.cache.get(config.channelId);
    if (!verifyChannel) {
      return interaction.editReply({
        content: 'Error: Target verification channel not found. Reconfigure and try again.',
      });
    }

    const verifyEmbed = new EmbedBuilder()
      .setTitle('ACCESS VERIFICATION REQUIRED')
      .setDescription(
        'This server is protected by **Verify Hydra**.\n\n' +
        `**Server**\n\`\`\`\n${interaction.guild.name}\n\`\`\`\n` +
        '**How it works**\n' +
        '1. Click the button below to start\n' +
        '2. Complete the captcha challenge on the secure page\n' +
        '3. Return here — your role will be assigned automatically\n\n' +
        '*Verification expires in 5 minutes.*'
      )
      .setColor(0xffffff)
      .setThumbnail(interaction.guild.iconURL({ size: 128 }))
      .setFooter({ text: `${interaction.guild.name} | Verify Hydra` })
      .setTimestamp();

    const verifyButton = new ButtonBuilder()
      .setCustomId('hydra_verify_button')
      .setLabel('Verify My Account')
      .setStyle(ButtonStyle.Primary);

    const verifyRow = new ActionRowBuilder().addComponents(verifyButton);

    await verifyChannel.send({
      embeds: [verifyEmbed],
      components: [verifyRow],
    });

    configStore.delete(interaction.guildId);

    const successEmbed = new EmbedBuilder()
      .setTitle('CONFIGURATION SAVED')
      .setDescription(
        `**Channel:** <#${config.channelId}>\n` +
        `**Verified Role:** <@&${config.roleId}>\n` +
        `**Quarantine Role:** <@&${config.unverifiedRoleId}>\n` +
        `**Security:** \`${config.securityLevel}\``
      )
      .setColor(0xffffff)
      .setFooter({ text: 'Verify Hydra | System Initialized' });

    await interaction.editReply({ embeds: [successEmbed] });

    console.log(`[Verify Hydra] Config saved for guild ${interaction.guildId}`);
  } catch (error) {
    console.error(`[Verify Hydra] Save config error:`, error.message);
    await interaction.editReply({
      content: 'Failed to save configuration. Check console for details.',
    });
  }
}

// ─── Already Verified Guard ──────────────────────────────────────────────────

async function isAlreadyVerified(client, interaction) {
  const guildSettings = await getGuildSettings(interaction.guildId);
  if (!guildSettings) return false;

  const guild = client.guilds.cache.get(interaction.guildId);
  if (!guild) return false;

  const member = await guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member) return false;

  const verifiedRole = guild.roles.cache.get(guildSettings.verified_role_id);
  if (!verifiedRole) return false;

  return member.roles.cache.has(verifiedRole.id);
}

// ─── Verify Button Handler ───────────────────────────────────────────────────

async function handleVerifyButton(client, interaction) {
  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

  try {
    if (await isAlreadyVerified(client, interaction)) {
      const alreadyEmbed = new EmbedBuilder()
        .setTitle('ACCOUNT STATUS')
        .setDescription('Your account is already verified within this server. Full access is granted.')
        .setColor(0x1a1a1a)
        .setFooter({ text: 'Verify Hydra | Access Confirmed' })
        .setTimestamp();

      return interaction.editReply({ embeds: [alreadyEmbed] });
    }

    const guildSettings = await getGuildSettings(interaction.guildId);
    const securityLevel = guildSettings ? guildSettings.security_level : 'dual-layer';

    // Build worker URL with protocol enforcement
    let workerUrl = (process.env.HYDRA_WORKER_URL || '').trim();
    if (!workerUrl) {
      throw new Error('HYDRA_WORKER_URL is not configured');
    }
    if (!workerUrl.startsWith('http://') && !workerUrl.startsWith('https://')) {
      workerUrl = `https://${workerUrl}`;
    }
    workerUrl = workerUrl.replace(/\/+$/, '');

    const requestUrl = `${workerUrl}/api/request-verification`;

    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.INTERNAL_API_KEY}`,
      },
      body: JSON.stringify({
        user_id: interaction.user.id,
        guild_id: interaction.guildId,
        guild_name: interaction.guild.name,
        security_level: securityLevel,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[Verify Hydra] Worker error (${response.status}):`, errorBody);
      let errorMsg = `Verification request failed (HTTP ${response.status})`;
      try {
        const parsed = JSON.parse(errorBody);
        errorMsg = parsed.message || errorMsg;
      } catch {}
      throw new Error(errorMsg);
    }

    const responseText = await response.text();

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseErr) {
      throw new Error(`Worker returned invalid JSON: ${responseText.substring(0, 100)}`);
    }

    const verification_url = data.verification_url;

    if (!verification_url || typeof verification_url !== 'string') {
      throw new Error(`Worker response missing verification_url. Got: ${JSON.stringify(data)}`);
    }

    if (!verification_url) {
      throw new Error('Worker returned empty verification URL');
    }

    // Sanitize and validate the URL
    let cleanUrl = verification_url.replace(/[\r\n\t]/g, '').trim();

    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }

    // Validate URL format before passing to Discord.js
    let parsedUrl;
    try {
      parsedUrl = new URL(cleanUrl);
    } catch (urlErr) {
      throw new Error(`Malformed verification URL: "${cleanUrl}"`);
    }

    if (!parsedUrl.protocol.startsWith('http')) {
      throw new Error(`Invalid protocol in verification URL: ${parsedUrl.protocol}`);
    }

    const finalUrl = parsedUrl.href;

    const embed = new EmbedBuilder()
      .setTitle('ACCESS VERIFICATION')
      .setDescription(
        'This server requires identity verification to ensure a secure environment.\n\n' +
        `**Server**\n\`\`\`\n${interaction.guild.name}\n\`\`\`\n` +
        '**Security Protocol**\n' +
        'Click the button below to initiate the verification process. ' +
        'You will be redirected to a secure page where you must complete a captcha challenge.\n\n' +
        '*This link expires in 5 minutes.*'
      )
      .setColor(0xffffff)
      .setThumbnail(interaction.guild.iconURL({ size: 128 }))
      .setFooter({ text: 'Verify Hydra | Secure Access Gateway' })
      .setTimestamp();

    const linkButton = new ButtonBuilder()
      .setLabel('Start Verification')
      .setURL(finalUrl)
      .setStyle(ButtonStyle.Link);

    const linkRow = new ActionRowBuilder().addComponents(linkButton);

    const reply = await interaction.editReply({ embeds: [embed], components: [linkRow] });

    startVerificationPoller(client, interaction.user.id, interaction.guildId, interaction);
  } catch (error) {
    console.error(`[Verify Hydra] Verify button error:`, error.message);
    await interaction.editReply({
      content:
        'Failed to generate verification link. Please try again later or contact an administrator.',
    });
  }
}

// ─── Pull-Based Verification Poller ──────────────────────────────────────────

function startVerificationPoller(client, userId, guildId, interaction) {
  const pollerKey = `${userId}:${guildId}`;

  if (activePollers.has(pollerKey)) return;

  const startTime = Date.now();
  const maxDuration = 5 * 60 * 1000;
  const pollInterval = 3000;

  const poller = setInterval(async () => {
    if (Date.now() - startTime > maxDuration) {
      clearInterval(poller);
      activePollers.delete(pollerKey);
      return;
    }

    try {
      const session = await getPendingSession(userId, guildId);

      if (!session) {
        const verifiedSession = await getVerifiedSession(userId, guildId);

        if (verifiedSession) {
          clearInterval(poller);
          activePollers.delete(pollerKey);

          await assignVerifiedRole(client, userId, guildId, verifiedSession);
          await sendVerificationComplete(client, interaction, userId, guildId);
          return;
        }
      }

      if (session && session.status === 'verified') {
        clearInterval(poller);
        activePollers.delete(pollerKey);

        await assignVerifiedRole(client, userId, guildId, session);
        await sendVerificationComplete(client, interaction, userId, guildId);
        return;
      }
    } catch (error) {
      console.error(`[Verify Hydra] Poller error:`, error.message);
    }
  }, pollInterval);

  activePollers.set(pollerKey, poller);
}

async function sendVerificationComplete(client, interaction, userId, guildId) {
  try {
    const guildSettings = await getGuildSettings(guildId);
    const guild = client.guilds.cache.get(guildId);
    if (!guild || !guildSettings) return;

    const member = await guild.members.fetch(userId).catch(() => null);
    const displayName = member ? member.displayName : 'User';
    const verifiedRole = guild.roles.cache.get(guildSettings.verified_role_id);
    const roleName = verifiedRole ? verifiedRole.name : 'Verified';

    const successEmbed = new EmbedBuilder()
      .setTitle('VERIFICATION COMPLETE')
      .setDescription(
        `<@${userId}>, your identity has been verified successfully.\n\n` +
        `**Role Assigned**\n\`\`\`\n${roleName}\n\`\`\`\n` +
        '**Status**\n' +
        'You now have full access to this server. Welcome to the community.'
      )
      .setColor(0xffffff)
      .setThumbnail(guild.iconURL({ size: 128 }))
      .setFooter({ text: `${guild.name} | Verify Hydra` })
      .setTimestamp();

    const successPayload = { embeds: [successEmbed], components: [] };

    try {
      await interaction.editReply(successPayload);
    } catch {
      try {
        await interaction.deleteReply();
      } catch {}
      await interaction.followUp({ ...successPayload, flags: [MessageFlags.Ephemeral] });
    }
  } catch (error) {
    console.error(`[Verify Hydra] Failed to send verification complete:`, error.message);
  }
}

async function assignVerifiedRole(client, userId, guildId, session) {
  try {
    const guildSettings = await getGuildSettings(guildId);
    if (!guildSettings) {
      console.error(`[Verify Hydra] No guild settings for ${guildId}`);
      return;
    }

    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      console.error(`[Verify Hydra] Guild ${guildId} not in cache`);
      return;
    }

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) {
      console.error(`[Verify Hydra] Member ${userId} not found in guild ${guildId}`);
      return;
    }

    const verifiedRole = guild.roles.cache.get(guildSettings.verified_role_id);
    if (!verifiedRole) {
      console.error(`[Verify Hydra] Verified role ${guildSettings.verified_role_id} not found`);
      return;
    }

    const botMember = guild.members.cache.get(client.user.id);
    if (botMember && botMember.roles.highest.position <= verifiedRole.position) {
      console.error(`[Verify Hydra] Bot role is below verified role in hierarchy. Move the HydraVerify role above "${verifiedRole.name}" in Server Settings > Roles.`);
      return;
    }

    if (!member.roles.cache.has(verifiedRole.id)) {
      await member.roles.add(verifiedRole, 'Verify Hydra - Account verified');
    }

    const botHighest = botMember ? botMember.roles.highest.position : 0;
    const rolesToRemove = member.roles.cache.filter(
      (role) =>
        role.id !== guild.id &&
        role.id !== verifiedRole.id &&
        !role.managed &&
        role.position < botHighest
    );

    if (rolesToRemove.size > 0) {
      await member.roles.remove(
        rolesToRemove.map((r) => r.id),
        'Verify Hydra - Clearing unverified roles'
      );
    }

    console.log(`[Verify Hydra] Verified user ${userId} in guild ${guildId} (${guild.name})`);
  } catch (error) {
    console.error(`[Verify Hydra] Role assignment error:`, error.message);
    if (error.message.includes('Missing Permissions')) {
      console.error(`[Verify Hydra] FIX: Move the HydraVerify bot role above the verified role in Server Settings > Roles`);
    }
  }
}
