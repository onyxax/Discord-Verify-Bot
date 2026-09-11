import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  MessageFlags,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ThumbnailBuilder,
} from 'discord.js';
import { getGuildSettings, upsertGuildSettings, getPendingSession, getVerifiedSession } from '../utils/supabase.js';

const configStore = new Map();
const activePollers = new Map();

export async function handleInteractionCreate(client, interaction) {
  try {
    if (interaction.isChatInputCommand()) {
      return handleSlashCommand(client, interaction);
    }

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

async function handleSlashCommand(client, interaction) {
  if (interaction.commandName === 'panel') {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: 'Server Administrator required.',
        flags: [MessageFlags.Ephemeral],
      });
    }

    // ── Components V2: كارد احترافي عرضي + زر داخل الكارد عبر Section accessory
    const guildIcon = interaction.guild.iconURL({ size: 128 });
    const botIcon = client.user.displayAvatarURL({ size: 128 });

    const headerText = new TextDisplayBuilder().setContent(
      `# VERIFY HYDRA | CONTROL PANEL\n` +
      `-# Automated Security Perimeter • Restricted to Server Owner\n` +
      `**${interaction.guild.name}**`
    );

    const stepsText = new TextDisplayBuilder().setContent(
      `Configure: \`1\` verification channel  •  \`2\` Verified role  •  \`3\` Quarantine role  •  \`4\` security level  •  \`5\` Save`
    );

    const fieldsRow = new TextDisplayBuilder().setContent(
      `### TARGET CHANNEL\nSelect the channel where the verification prompt will be posted.\n\n` +
      `### VERIFIED ROLE\nSelect the role assigned to verified members.\n\n` +
      `### QUARANTINE ROLE\nSelect the role assigned to new unverified members.`
    );

    const securityText = new TextDisplayBuilder().setContent(
      `### SECURITY LEVEL\n\`image-captcha\` • \`hcaptcha\` • \`dual-layer\` (Recommended)`
    );

    const channels = interaction.guild.channels.cache.filter((ch) => ch.type === 0);
    const roles = interaction.guild.roles.cache.filter((r) => !r.managed && r.id !== interaction.guild.id);

    const container = new ContainerBuilder()
      .setAccentColor(0xffffff)
      .addTextDisplayComponents(headerText)
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(stepsText)
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(fieldsRow)
      .addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(securityText);

    // إضافة القوائم كـ ActionRow داخل الكونتينر
    if (channels.size > 0) {
      const channelSelect = new StringSelectMenuBuilder()
        .setCustomId('hydra_select_channel')
        .setPlaceholder('Select verification channel')
        .addOptions(
          channels.first(25).map((ch) => ({
            label: ch.name,
            value: ch.id,
            description: `#${ch.name}`,
          }))
        );
      container.addActionRowComponents(new ActionRowBuilder().addComponents(channelSelect));
    }

    if (roles.size > 0) {
      const verifiedRoleSelect = new StringSelectMenuBuilder()
        .setCustomId('hydra_select_role')
        .setPlaceholder('Select verified role')
        .addOptions(
          roles.first(25).map((r) => ({
            label: r.name,
            value: r.id,
            description: `Role: ${r.name}`,
          }))
        );
      container.addActionRowComponents(new ActionRowBuilder().addComponents(verifiedRoleSelect));

      const unverifiedRoleSelect = new StringSelectMenuBuilder()
        .setCustomId('hydra_select_unverified_role')
        .setPlaceholder('Select quarantine role')
        .addOptions(
          roles.first(25).map((r) => ({
            label: r.name,
            value: r.id,
            description: `Role: ${r.name}`,
          }))
        );
      container.addActionRowComponents(new ActionRowBuilder().addComponents(unverifiedRoleSelect));
    }

    const securitySelect = new StringSelectMenuBuilder()
      .setCustomId('hydra_select_security')
      .setPlaceholder('Select security intensity')
      .addOptions(
        { label: 'Image Captcha', value: 'image-captcha', description: 'Visual challenge verification' },
        { label: 'hCaptcha', value: 'hcaptcha', description: 'hCaptcha widget verification' },
        { label: 'Dual-Layer (Recommended)', value: 'dual-layer', description: 'Maximum security - both captcha types' }
      );
    container.addActionRowComponents(new ActionRowBuilder().addComponents(securitySelect));

    const saveButton = new ButtonBuilder()
      .setCustomId('hydra_save_config')
      .setLabel('Save and Initialize')
      .setStyle(ButtonStyle.Success);

    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**Ready to save?**\nMake sure all four fields are selected then click the button on the right.`)
        )
        .setButtonAccessory(saveButton)
    );

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# Verify Hydra • Edge Verification • ${interaction.guild.name}`)
    );

    // مع V2 لازم flag خاص، و ephemeral يبقى عبر OR
    await interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
  }

  if (interaction.commandName === 'setup') {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: 'Server Administrator required.',
        flags: [MessageFlags.Ephemeral],
      });
    }

    const channel = interaction.options.getChannel('channel');
    const verifiedRole = interaction.options.getRole('verified_role');
    const quarantineRole = interaction.options.getRole('quarantine_role');
    const security = interaction.options.getString('security');

    if (channel.type !== 0) {
      return interaction.reply({ content: 'Channel must be a text channel.', flags: [MessageFlags.Ephemeral] });
    }

    if (quarantineRole.managed || quarantineRole.id === interaction.guild.id) {
      return interaction.reply({ content: 'Invalid quarantine role.', flags: [MessageFlags.Ephemeral] });
    }

    await upsertGuildSettings({
      guild_id: interaction.guildId,
      control_channel_id: interaction.channelId,
      public_verify_channel_id: channel.id,
      verified_role_id: verifiedRole.id,
      unverified_role_id: quarantineRole.id,
      security_level: security,
    });

    const botIconV1 = client.user.displayAvatarURL({ size: 128, extension: 'png' });
    const verifyContainer = new ContainerBuilder().setAccentColor(0xffffff);
    verifyContainer.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## Verify to access this server`),
          new TextDisplayBuilder().setContent(
            `Verify your account to join this server — it only takes a moment.\n` +
            `-# ${interaction.guild.name}  •  ${interaction.guild.memberCount} members  •  Security: ${security}`
          )
        )
        .setThumbnailAccessory(new ThumbnailBuilder({ media: { url: botIconV1 } }))
    );
    verifyContainer
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**How to verify:** Click the button below → Complete the check on the site → Return — you're verified.`)
      )
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('hydra_verify_button')
            .setLabel('Verify my account')
            .setStyle(ButtonStyle.Success)
        )
      )
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Powered by Verify Hydra • Trusted verification`));

    await channel.send({
      components: [verifyContainer],
      flags: MessageFlags.IsComponentsV2,
    });

    const successContainer = new ContainerBuilder()
      .setAccentColor(0xffffff)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## CONFIGURATION SAVED`))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`This server is now protected by Verify Hydra.`)
      )
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `Channel: <#${channel.id}>  •  Verified: <@&${verifiedRole.id}>  •  Quarantine: <@&${quarantineRole.id}>\n` +
          `Security: \`${security}\``
        )
      )
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Verify Hydra | System Initialized`));

    await interaction.reply({
      components: [successContainer],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
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
    return interaction.deferUpdate();
  }

  if (customId === 'hydra_select_role') {
    config.roleId = values[0];
    configStore.set(guildId, config);
    return interaction.deferUpdate();
  }

  if (customId === 'hydra_select_security') {
    config.securityLevel = values[0];
    configStore.set(guildId, config);
    return interaction.deferUpdate();
  }

  if (customId === 'hydra_select_unverified_role') {
    config.unverifiedRoleId = values[0];
    configStore.set(guildId, config);
    return interaction.deferUpdate();
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

    const botIconV2 = client.user.displayAvatarURL({ size: 128, extension: 'png' });
    const verifyContainer2 = new ContainerBuilder().setAccentColor(0xffffff);
    verifyContainer2.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## Verify to access this server`),
          new TextDisplayBuilder().setContent(
            `Verify your account to join this server — it only takes a moment.\n` +
            `-# ${interaction.guild.name}  •  ${interaction.guild.memberCount} members  •  Security: ${config.securityLevel}`
          )
        )
        .setThumbnailAccessory(new ThumbnailBuilder({ media: { url: botIconV2 } }))
    );
    verifyContainer2
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**How to verify:** Click the button below → Complete the check on the site → Return — you're verified.`)
      )
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('hydra_verify_button')
            .setLabel('Verify my account')
            .setStyle(ButtonStyle.Success)
        )
      )
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Powered by Verify Hydra • Trusted verification`));

    await verifyChannel.send({
      components: [verifyContainer2],
      flags: MessageFlags.IsComponentsV2,
    });

    configStore.delete(interaction.guildId);

    const successContainer2 = new ContainerBuilder()
      .setAccentColor(0xffffff)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## CONFIGURATION SAVED`))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`This server is now protected by Verify Hydra.`)
      )
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `Channel: <#${config.channelId}>  •  Verified: <@&${config.roleId}>  •  Quarantine: <@&${config.unverifiedRoleId}>\n` +
          `Security: \`${config.securityLevel}\``
        )
      )
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Verify Hydra | System Initialized`));

    await interaction.editReply({
      components: [successContainer2],
      flags: MessageFlags.IsComponentsV2,
    });

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
      const alreadyContainer = new ContainerBuilder()
        .setAccentColor(0xffffff)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ACCOUNT STATUS`))
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`Your account is already verified within this server. Full access is granted.`)
        )
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Verify Hydra | Access Confirmed`));

      return interaction.editReply({
        components: [alreadyContainer],
        flags: MessageFlags.IsComponentsV2,
      });
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

    const botIconLink = client.user.displayAvatarURL({ size: 128, extension: 'png' });
    const verifyLinkContainer = new ContainerBuilder().setAccentColor(0xffffff);
    verifyLinkContainer.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## Verify to access this server`),
          new TextDisplayBuilder().setContent(
            `Verify your account to join this server — it only takes a moment.\n` +
            `-# ${interaction.guild.name}  •  ${interaction.guild.memberCount} members  •  Security: ${securityLevel}`
          )
        )
        .setThumbnailAccessory(new ThumbnailBuilder({ media: { url: botIconLink } }))
    );
    verifyLinkContainer
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**How to verify:** Click the button below → Complete the check on the site → Return — you're verified.`)
      )
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel('Open verification site')
            .setURL(finalUrl)
            .setStyle(ButtonStyle.Link)
        )
      )
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Powered by Verify Hydra • Trusted verification`));

    const reply = await interaction.editReply({
      components: [verifyLinkContainer],
      flags: MessageFlags.IsComponentsV2,
    });

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

    const botIconComplete = client.user.displayAvatarURL({ size: 128, extension: 'png' });
    const completeContainer = new ContainerBuilder().setAccentColor(0xffffff);
    completeContainer.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## VERIFICATION COMPLETE`),
          new TextDisplayBuilder().setContent(
            `<@${userId}>, your identity has been verified successfully.\n\n` +
            `Role Assigned: \`${roleName}\`\n` +
            `Status: You now have full access to this server. Welcome to the community.`
          )
        )
        .setThumbnailAccessory(new ThumbnailBuilder({ media: { url: botIconComplete } }))
    );
    completeContainer
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${guild.name} | Verify Hydra`));

    const successPayloadV2 = {
      components: [completeContainer],
      flags: MessageFlags.IsComponentsV2,
    };

    try {
      await interaction.editReply(successPayloadV2);
    } catch {
      try {
        await interaction.deleteReply();
      } catch {}
      await interaction.followUp({ ...successPayloadV2, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
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
