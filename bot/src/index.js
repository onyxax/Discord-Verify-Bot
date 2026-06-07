import 'dotenv/config';
import { Client, GatewayIntentBits, ActivityType } from 'discord.js';
import { handleGuildCreate } from './events/guildCreate.js';
import { handleInteractionCreate } from './events/interactionCreate.js';
import { handleGuildMemberAdd } from './events/guildMemberAdd.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once('clientReady', () => {
  const count = client.guilds.cache.size;
  client.user.setActivity(`${count} servers`, { type: ActivityType.Playing });
  console.log(`[Verify Hydra] Bot online: ${client.user.tag}`);
  console.log(`[Verify Hydra] Serving ${count} guild(s)`);
});

client.on('guildCreate', (guild) => {
  handleGuildCreate(client, guild);
  const count = client.guilds.cache.size;
  client.user.setActivity(`${count} servers`, { type: ActivityType.Playing });
});

client.on('guildMemberAdd', (member) => handleGuildMemberAdd(client, member));
client.on('interactionCreate', (interaction) => handleInteractionCreate(client, interaction));

client.login(process.env.DISCORD_TOKEN);
