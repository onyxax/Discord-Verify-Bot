import 'dotenv/config';
import { REST, Routes } from 'discord.js';

const commands = [
  {
    name: 'panel',
    description: 'Open the Verify Hydra configuration panel',
  },
  {
    name: 'setup',
    description: 'Quick setup: set channel, roles, and security level',
    options: [
      {
        name: 'channel',
        description: 'Verification channel',
        type: 7,
        required: true,
      },
      {
        name: 'verified_role',
        description: 'Role assigned after verification',
        type: 8,
        required: true,
      },
      {
        name: 'quarantine_role',
        description: 'Role for unverified members',
        type: 8,
        required: true,
      },
      {
        name: 'security',
        description: 'Security level',
        type: 3,
        required: true,
        choices: [
          { name: 'Image Captcha', value: 'image-captcha' },
          { name: 'hCaptcha', value: 'hcaptcha' },
          { name: 'Dual-Layer (Recommended)', value: 'dual-layer' },
        ],
      },
    ],
  },
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

try {
  console.log('Registering slash commands...');
  await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body: commands });
  console.log('Slash commands registered successfully.');
} catch (error) {
  console.error('Failed to register commands:', error);
}
