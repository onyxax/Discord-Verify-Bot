import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { handleGuildCreate } from './events/guildCreate.js';
import { handleInteractionCreate } from './events/interactionCreate.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once('clientReady', () => {
  console.log(`[Verify Hydra] Bot online: ${client.user.tag}`);
  console.log(`[Verify Hydra] Serving ${client.guilds.cache.size} guild(s)`);
});

client.on('guildCreate', (guild) => handleGuildCreate(client, guild));

client.on('interactionCreate', (interaction) => handleInteractionCreate(client, interaction));

client.login(process.env.DISCORD_TOKEN);
