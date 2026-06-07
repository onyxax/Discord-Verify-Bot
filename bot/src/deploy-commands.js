import 'dotenv/config';
import { REST, Routes } from 'discord.js';

const commands = [
  {
    name: 'panel',
    description: 'Open the Verify Hydra configuration panel',
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
