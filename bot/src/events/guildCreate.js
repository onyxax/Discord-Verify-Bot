import {
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} from 'discord.js';

export async function handleGuildCreate(client, guild) {
  try {
    let controlChannel = null;

    const permissionOverwrites = [
      {
        id: guild.id,
        deny: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
      {
        id: client.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageMessages,
        ],
      },
    ];

    const owner = await guild.members.fetch(guild.ownerId).catch(() => null);
    if (owner) {
      permissionOverwrites.push({
        id: owner.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageChannels,
        ],
      });
    }

    try {
      controlChannel = await guild.channels.create({
        name: 'verify-hydra-control',
        type: ChannelType.GuildText,
        topic: 'Verify Hydra Configuration Panel | Bot Access Only',
        permissionOverwrites,
      });
    } catch {
      controlChannel = guild.systemChannel;
    }

    if (!controlChannel) {
      console.error(`[Verify Hydra] No accessible channel in ${guild.name}. Grant Administrator permission and re-invite.`);
      return;
    }

    // ── Components V2: كارد احترافي + زر داخل الكارد
    const headerText = new TextDisplayBuilder().setContent(
      `# VERIFY HYDRA | CONTROL PANEL\n` +
      `-# Automated Security Perimeter • Owner Only\n` +
      `**${guild.name}**`
    );
    const stepsText = new TextDisplayBuilder().setContent(
      `Configure: \`1\` verification channel  •  \`2\` Verified role  •  \`3\` Quarantine role  •  \`4\` security level`
    );
    const fieldsRow = new TextDisplayBuilder().setContent(
      `### TARGET CHANNEL\nSelect the channel where the verification prompt will be posted.\n\n` +
      `### VERIFIED ROLE\nSelect the role assigned to verified members.\n\n` +
      `### QUARANTINE ROLE\nSelect the role assigned to new unverified members.`
    );
    const securityText = new TextDisplayBuilder().setContent(
      `### SECURITY LEVEL\n\`image-captcha\` • \`hcaptcha\` • \`dual-layer\` (Recommended)`
    );

    const channels = guild.channels.cache.filter((ch) => ch.type === ChannelType.GuildText);
    const roles = guild.roles.cache.filter((r) => !r.managed && r.id !== guild.id);

    const container = new ContainerBuilder()
      .setAccentColor(0xffffff)
      .addTextDisplayComponents(headerText)
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(stepsText)
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(fieldsRow)
      .addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(securityText);

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
      new TextDisplayBuilder().setContent(`-# Verify Hydra • Edge Verification • ${guild.name}`)
    );

    try {
      await controlChannel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });
      console.log(`[Verify Hydra] Control panel created in ${guild.name} (${guild.id})`);
    } catch (sendError) {
      console.error(`[Verify Hydra] Channel created but panel failed in ${guild.name}:`, sendError.message);
    }
  } catch (error) {
    console.error(`[Verify Hydra] Failed in ${guild.name}:`, error.message);
  }
}
