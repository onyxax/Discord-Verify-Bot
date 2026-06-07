import {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';

export async function handleGuildCreate(client, guild) {
  try {
    const owner = await guild.members.fetch(guild.ownerId).catch(() => null);

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

    const controlChannel = await guild.channels.create({
      name: 'verify-hydra-control',
      type: ChannelType.GuildText,
      topic: 'Verify Hydra Configuration Panel | Bot Access Only',
      permissionOverwrites,
    });

    const embed = new EmbedBuilder()
      .setTitle('VERIFY HYDRA | CONTROL PANEL')
      .setDescription(
        'Configure the verification system for this server.\n' +
        'All settings are restricted to the Server Owner.\n\n' +
        '-> Step 1: Select the public verification channel\n' +
        '-> Step 2: Select the role granted upon verification\n' +
        '-> Step 3: Select the quarantine role for new members\n' +
        '-> Step 4: Choose the security intensity level\n' +
        '-> Step 5: Click "Save and Initialize"'
      )
      .setColor(0xffffff)
      .addFields(
        {
          name: '\u2588 TARGET CHANNEL',
          value: 'Select the channel where the verification prompt will be posted.',
          inline: false,
        },
        {
          name: '\u2588 VERIFIED ROLE',
          value: 'Select the role assigned to verified members.',
          inline: false,
        },
        {
          name: '\u2588 QUARANTINE ROLE',
          value: 'Select the role assigned to new unverified members.',
          inline: false,
        },
        {
          name: '\u2588 SECURITY LEVEL',
          value:
            '`image-captcha` | Image-based challenge\n' +
            '`hcaptcha` | hCaptcha widget integration\n' +
            '`dual-layer` | Both captcha layers (Recommended)',
          inline: false,
        }
      )
      .setFooter({ text: 'Verify Hydra | Automated Security Perimeter' })
      .setTimestamp();

    const channels = guild.channels.cache.filter((ch) => ch.type === ChannelType.GuildText);
    const roles = guild.roles.cache.filter((r) => !r.managed && r.id !== guild.id);

    const components = [];

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
      components.push(new ActionRowBuilder().addComponents(channelSelect));
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
      components.push(new ActionRowBuilder().addComponents(verifiedRoleSelect));

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
      components.push(new ActionRowBuilder().addComponents(unverifiedRoleSelect));
    }

    const securitySelect = new StringSelectMenuBuilder()
      .setCustomId('hydra_select_security')
      .setPlaceholder('Select security intensity')
      .addOptions(
        {
          label: 'Image Captcha',
          value: 'image-captcha',
          description: 'Visual challenge verification',
        },
        {
          label: 'hCaptcha',
          value: 'hcaptcha',
          description: 'hCaptcha widget verification',
        },
        {
          label: 'Dual-Layer (Recommended)',
          value: 'dual-layer',
          description: 'Maximum security - both captcha types',
        }
      );
    components.push(new ActionRowBuilder().addComponents(securitySelect));

    const saveButton = new ButtonBuilder()
      .setCustomId('hydra_save_config')
      .setLabel('Save and Initialize')
      .setStyle(ButtonStyle.Success);
    components.push(new ActionRowBuilder().addComponents(saveButton));

    await controlChannel.send({
      embeds: [embed],
      components,
    });

    console.log(`[Verify Hydra] Control panel created in ${guild.name} (${guild.id})`);
  } catch (error) {
    console.error(`[Verify Hydra] Failed to create control panel in ${guild.name}:`, error.message);
  }
}
