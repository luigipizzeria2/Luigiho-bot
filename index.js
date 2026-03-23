console.log("BOT VERSION TEST 123");
require('dotenv').config();

const express = require('express');
const app = express();

app.get('/status', (req, res) => {
    res.json({ 
        online: client.isReady(),
        avatar: app.locals.avatarURL || null
    });
});

app.get('/', (req, res) => res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Luigiho Bot :D</title>
<link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --purple: #5865F2;
    --purple-dark: #4752c4;
    --purple-light: #7983f5;
    --bg: #0e0f13;
    --bg2: #16181f;
    --bg3: #1e2028;
    --border: rgba(88,101,242,0.2);
    --text: #e8e9f0;
    --muted: #8b8fa8;
    --green: #3ba55d;
    --red: #ed4245;
  }

  body {
    font-family: 'Rajdhani', sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3rem 1.5rem;
  }

  .glow {
    position: fixed; top: -200px; left: 50%; transform: translateX(-50%);
    width: 600px; height: 400px;
    background: radial-gradient(ellipse, rgba(88,101,242,0.15) 0%, transparent 70%);
    pointer-events: none;
  }

  .header {
    display: flex; flex-direction: column; align-items: center; gap: 1rem;
    margin-bottom: 3rem; text-align: center;
  }

  .avatar {
    width: 80px; height: 80px; border-radius: 50%;
    background: linear-gradient(135deg, var(--purple), var(--purple-light));
    display: flex; align-items: center; justify-content: center;
    font-size: 2rem; font-weight: 700; color: white;
    box-shadow: 0 0 40px rgba(88,101,242,0.4);
  }

  h1 { font-size: 2rem; font-weight: 700; letter-spacing: -0.5px; }
  h1 span { color: var(--purple-light); }

  .status-pill {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 6px 16px; border-radius: 99px;
    background: var(--bg3); border: 1px solid var(--border);
    font-size: 0.85rem; font-weight: 500;
  }

  .dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--green);
    box-shadow: 0 0 8px var(--green);
    animation: pulse 2s infinite;
  }
  .dot.offline { background: var(--red); box-shadow: 0 0 8px var(--red); animation: none; }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1rem; width: 100%; max-width: 860px;
  }

  .card {
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 1.5rem;
    transition: border-color 0.2s, transform 0.2s;
  }
  .card:hover { border-color: var(--purple); transform: translateY(-2px); }

  .card-icon {
    font-size: 1.5rem; margin-bottom: 0.75rem;
  }

  .card h3 { font-size: 1rem; font-weight: 600; margin-bottom: 0.4rem; }
  .card p { font-size: 0.85rem; color: var(--muted); line-height: 1.5; }

  .commands {
    margin-top: 2rem; width: 100%; max-width: 860px;
  }

  .commands h2 {
    font-size: 1.1rem; font-weight: 600; color: var(--muted);
    text-transform: uppercase; letter-spacing: 1px;
    margin-bottom: 1rem;
  }

  .cmd-list { display: flex; flex-direction: column; gap: 0.5rem; }

  .cmd {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 10px; padding: 0.9rem 1.2rem;
    display: flex; align-items: center; gap: 1rem;
  }

  .cmd-name {
    font-family: monospace; font-size: 0.95rem;
    color: var(--purple-light); font-weight: 600; min-width: 140px;
  }

  .cmd-desc { font-size: 0.85rem; color: var(--muted); }

  footer {
    margin-top: 3rem; font-size: 0.8rem; color: var(--muted);
  }
</style>
</head>
<body>
<div class="glow"></div>

<div class="header">
  <img id="avatar" src="" width="80" height="80" style="border-radius:50%; box-shadow: 0 0 40px rgba(88,101,242,0.4); display:none;">
<div class="avatar" id="avatar-fallback">L</div>
  <h1>Luigiho <span>Bot</span></h1>
  <div class="status-pill">
    <div class="dot" id="dot"></div>
    <span id="status-text">Checking...</span>
  </div>
</div>

<div class="grid">
  <div class="card">
    <div class="card-icon">🎟️</div>
    <h3>Ticket System</h3>
    <p>Open support tickets by category. Staff can claim and close tickets directly from Discord.</p>
  </div>
  <div class="card">
    <div class="card-icon">📢</div>
    <h3>Suggestion Polls</h3>
    <p>Create timed polls with yes/no voting. Results are announced automatically when the poll ends.</p>
  </div>
  <div class="card">
    <div class="card-icon">⚙️</div>
    <h3>Admin Setup</h3>
    <p>Configure staff roles, enable or disable commands per-server using simple slash commands.</p>
  </div>
  <div class="card">
    <div class="card-icon">🎥</div>
    <h3>YouTube Collabs</h3>
    <p>Dedicated ticket type for YouTube collaboration requests, routed directly to staff.</p>
  </div>
</div>

<div class="cmd-list">
    <div class="cmd"><span class="cmd-name">/ticketpanel</span><span class="cmd-desc">Send the support ticket panel to a channel</span></div>
    <div class="cmd"><span class="cmd-name">/close</span><span class="cmd-desc">Close your currently open ticket</span></div>
    <div class="cmd"><span class="cmd-name">/suggest</span><span class="cmd-desc">Create a suggestion poll with a custom duration</span></div>
    <div class="cmd"><span class="cmd-name">/8ball</span><span class="cmd-desc">Ask the magic 8ball a question</span></div>
    <div class="cmd"><span class="cmd-name">/baldi</span><span class="cmd-desc">baldiho command</span></div>
    <div class="cmd"><span class="cmd-name">/lukasz</span><span class="cmd-desc">lukasovo command</span></div>
    <div class="cmd"><span class="cmd-name">/baf</span><span class="cmd-desc">vylekej bota</span></div>
    <div class="cmd"><span class="cmd-name">/koika</span><span class="cmd-desc">zvuk kocky</span></div>
    <div class="cmd"><span class="cmd-name">/setyoutube</span><span class="cmd-desc">Set YouTube announcement channel and ping roles</span></div>
    <div class="cmd"><span class="cmd-name">/setup</span><span class="cmd-desc">Configure staff role and enable/disable commands</span></div>
</div>
</div>

<footer>
  Luigiho Bot &mdash; Running on Discord.js v14 &mdash;
  <a href="https://discord.com/oauth2/authorize?client_id=1473059410002575371&permissions=8&scope=bot%20applications.commands" 
     target="_blank" style="color: var(--purple-light); text-decoration: none;">
    Invite Bot
  </a>
</footer>

<script>
  fetch('/status')
    .then(r => r.json())
    .then(data => {
      const dot = document.getElementById('dot');
      const text = document.getElementById('status-text');
      if (data.online) {
        dot.classList.remove('offline');
        text.textContent = 'Online';
      } else {
        dot.classList.add('offline');
        text.textContent = 'Offline';
      }
      if (data.avatar) {
        const img = document.getElementById('avatar');
        const fallback = document.getElementById('avatar-fallback');
        img.src = data.avatar;
        img.style.display = 'block';
        fallback.style.display = 'none';
      }
    })
    .catch(() => {
      document.getElementById('status-text').textContent = 'Unknown';
    });
</script>
</body>
</html>`));

// self ping to prevent sleeping
setInterval(() => { fetch('https://obvious-maribel-luigiho-pizzerie-242e17fc.koyeb.app/') .catch(() => {}); }, 5 * 60 * 1000);

const {
    Client,
    GatewayIntentBits,
    PermissionsBitField,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    Events,
    REST,
    Routes,
    SlashCommandBuilder,
    ChannelType,
    StringSelectMenuBuilder
} = require('discord.js');

const { MongoClient } = require('mongodb');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
const staffRoleId = process.env.STAFF_ROLE_ID;
const mongoURI = process.env.MONGO_URI;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers
    ]
});
let database;
const activePolls = new Map();

// ================= DATABASE =================
async function connectDB() {
    const mongo = new MongoClient(mongoURI);
    await mongo.connect();
    database = mongo.db("ticketBot");
    console.log("✅ Connected to MongoDB");
}

async function incrementTicketCount() {
    const result = await database.collection("config").findOneAndUpdate(
        { name: "counter" },
        { $inc: { value: 1 } },
        { upsert: true, returnDocument: "after" }
    );
    return result.value.value;
}

async function getSettings() {
    const data = await database.collection("config").findOne({ name: "settings" });
    return data || {};
}

// ================= TIME PARSER =================
function parseTime(input) {
    const match = input.match(/^(\d+)([smhd])$/);
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2];

    const multipliers = {
        s: 1000,
        m: 60000,
        h: 3600000,
        d: 86400000
    };

    return value * multipliers[unit];
}

// ================= REGISTER COMMANDS =================
async function registerCommands() {
    const commands = [
        
        new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure the bot')
    .addRoleOption(option =>
        option.setName('staffrole')
            .setDescription('Set staff role')
    )
    .addStringOption(option =>
        option.setName('enable')
            .setDescription('Enable a command')
    )
    .addStringOption(option =>
        option.setName('disable')
            .setDescription('Disable a command')
    ),

        new SlashCommandBuilder()
    .setName('ticketpanel')
    .setDescription('Send the support ticket panel')
    .addStringOption(option =>
        option.setName('types')
            .setDescription('Custom types separated by commas')
    ),

        new SlashCommandBuilder()
            .setName('close')
            .setDescription('Close your open ticket'),

        new SlashCommandBuilder()
            .setName('suggest')
            .setDescription('Create a suggestion poll')
            .addStringOption(option =>
                option.setName('text')
                    .setDescription('Your suggestion')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option.setName('time')
                    .setDescription('Time (e.g. 10m, 1h, 2d)')
                    .setRequired(true)
            ),
new SlashCommandBuilder()
    .setName('8ball')
    .setDescription('Ask the magic 8ball a question')
    .addStringOption(option =>
        option.setName('question')
            .setDescription('Your question')
            .setRequired(true)
        ),

new SlashCommandBuilder()
    .setName('baldi')
    .setDescription('baldiho command'),

new SlashCommandBuilder()
    .setName('lukasz')
    .setDescription('lukasovo command'),

new SlashCommandBuilder()
    .setName('koika')
    .setDescription('zvuk co dela kocka'),

new SlashCommandBuilder()
    .setName('baf')
    .setDescription('vydes bota'),

new SlashCommandBuilder()
    .setName('setyoutube')
    .setDescription('Set YouTube announcement channel')
    .addChannelOption(option =>
        option.setName('channel')
            .setDescription('Channel to post announcements in')
            .setRequired(true)
    )
    .addRoleOption(option =>
        option.setName('role1')
            .setDescription('Ping role for main channel https://www.youtube.com/channel/UCG6Ti9RLDK_B78hIAlCUdfQ')
            .setRequired(true)
    )
    .addRoleOption(option =>
        option.setName('role2')
            .setDescription('Ping role for second channel https://www.youtube.com/channel/UCziBqG_7kDA4Jclw6BAh5dw')
            .setRequired(true)
    ),

    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: '10' }).setToken(token);

    await rest.put(
    Routes.applicationCommands(clientId),
    { body: [] }
);

const targetGuildId = process.env.TEST_MODE === 'true' 
    ? process.env.TEST_GUILD_ID 
    : guildId;

await rest.put(
    Routes.applicationGuildCommands(clientId, targetGuildId),
    { body: commands }
);

    console.log("Slash commands registered.");
}

// ================= YOUTUBE CHECKER =================
const Parser = require('rss-parser');
const rssParser = new Parser();

const youtubeChannels = [
    { id: 'UCG6Ti9RLDK_B78hIAlCUdfQ', name: 'luigipizzeria2', roleKey: 'role1' },
    { id: 'UCziBqG_7kDA4Jclw6BAh5dw', name: 'lugi', roleKey: 'role2' }
];

const lastVideoIds = new Map();

async function checkYouTube() {
    try {
        const config = await database.collection("config").findOne({ name: "youtube" });
        if (!config || !config.channelId) return;

        const discordChannel = await client.channels.fetch(config.channelId).catch(() => null);
        if (!discordChannel) return;

        for (const yt of youtubeChannels) {
            const feed = await rssParser.parseURL(
                `https://www.youtube.com/feeds/videos.xml?channel_id=${yt.id}`
            ).catch(() => null);
            if (!feed || !feed.items.length) continue;

            const latest = feed.items[0];
            const lastId = lastVideoIds.get(yt.id);

            if (lastId && lastId !== latest.id) {
                const roleId = config[yt.roleKey];
                await discordChannel.send(
                    `${roleId ? `<@&${roleId}>` : ''} 🎥 ** ${yt.name} právě vydal nové video!**\n**${latest.title}**\n${latest.link}`
                );
            }

            lastVideoIds.set(yt.id, latest.id);
        }
    } catch (err) {
        console.error('YouTube check error:', err);
    }
}

client.once(Events.ClientReady, () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    app.locals.avatarURL = client.user.displayAvatarURL({ size: 256, extension: 'png' });

    // Initialize last video IDs on startup (no announcements for existing videos)
    setTimeout(async () => {
        for (const yt of youtubeChannels) {
            const feed = await rssParser.parseURL(
                `https://www.youtube.com/feeds/videos.xml?channel_id=${yt.id}`
            ).catch(() => null);
            if (feed && feed.items.length) {
                lastVideoIds.set(yt.id, feed.items[0].id);
            }
        }
        console.log('✅ YouTube checker initialized');
        // Check every 5 minutes
        setInterval(checkYouTube, 5 * 60 * 1000);
    }, 3000);
});

// ================= FIND USER TICKET =================
function findUserTicket(guild, userId) {
    return guild.channels.cache.find(channel =>
        channel.parent &&
        channel.parent.name === "Tickets" &&
        channel.permissionOverwrites.cache.has(userId)
    );
}

// ================= INTERACTIONS =================
client.on(Events.InteractionCreate, async interaction => {

    try {

        // ================= SLASH COMMANDS =================
        if (interaction.isChatInputCommand()) {
            const settings = await getSettings();

let disabled = settings.disabled || [];

if (!Array.isArray(disabled)) {
    disabled = [disabled];
}

if (disabled.includes(interaction.commandName.toLowerCase())) {
    return interaction.reply({
        content: "❌ This command is disabled.",
        ephemeral: true
    });
}

            // ==== SETUP ====
if (interaction.commandName === 'setup') {

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ content: "❌ Admin only.", ephemeral: true });
    }

    const role = interaction.options.getRole('staffrole');
    const enable = interaction.options.getString('enable');
    const disable = interaction.options.getString('disable');

    // List of all toggleable commands
    const toggleable = [
        'ticketpanel', 'close', 'suggest', '8ball',
        'baldi', 'lukasz', 'koika', 'baf', 'setyoutube'
    ];

    // If no options provided, show current status
    if (!role && !enable && !disable) {
        const settings = await getSettings();
        const disabled = settings.disabled || [];

        const statusList = toggleable.map(cmd =>
            `${disabled.includes(cmd) ? '🔴' : '🟢'} /${cmd}`
        ).join('\n');

        return interaction.reply({
            content: `**Command Status:**\n${statusList}\n\nUse \`/setup enable:<command>\` or \`/setup disable:<command>\` to toggle.`,
            ephemeral: true
        });
    }

    const update = {};

    if (role) {
        update.$set = { staffRole: role.id };
    }

    if (enable) {
        if (!toggleable.includes(enable.toLowerCase())) {
            return interaction.reply({
                content: `❌ Unknown command. Available: ${toggleable.map(c => `\`${c}\``).join(', ')}`,
                ephemeral: true
            });
        }
        update.$pull = { disabled: enable.toLowerCase() };
    }

    if (disable) {
        if (!toggleable.includes(disable.toLowerCase())) {
            return interaction.reply({
                content: `❌ Unknown command. Available: ${toggleable.map(c => `\`${c}\``).join(', ')}`,
                ephemeral: true
            });
        }
        update.$addToSet = { disabled: disable.toLowerCase() };
    }

    await database.collection("config").updateOne(
        { name: "settings" },
        update,
        { upsert: true }
    );

    return interaction.reply({ content: "✅ Settings updated.", ephemeral: true });
}

            // ===== TICKET PANEL =====
            if (interaction.commandName === 'ticketpanel') {

                if (findUserTicket(interaction.guild, interaction.user.id)) {
                    return interaction.reply({
                        content: "❌ You already have an open ticket.",
                        ephemeral: true
                    });
                }

                const embed = new EmbedBuilder()
                    .setTitle("🎟 Open a Ticket")
                    .setDescription("Select the type of ticket below.")
                    .setColor(0x5865F2);

                const customTypes = interaction.options.getString("types");

let ticketTypes = [
    { label: "Minecraft Server Help", value: "minecraft", emoji: "🎮" },
    { label: "Suggestion", value: "suggestion", emoji: "💡" },
    { label: "Need Help", value: "help", emoji: "❓" },
    { label: "YouTube Collab", value: "youtube", emoji: "🎥" }
];

if (customTypes) {
    ticketTypes = customTypes.split(",").map(t => ({
        label: t.trim(),
        value: t.trim().toLowerCase()
    }));
}

const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("select_ticket_type")
    .setPlaceholder("Choose a ticket type")
    .addOptions(ticketTypes);

                return interaction.reply({
                    embeds: [embed],
                    components: [new ActionRowBuilder().addComponents(selectMenu)]
                });
            }

            // ===== CLOSE COMMAND =====
            if (interaction.commandName === 'close') {

                await interaction.deferReply({ ephemeral: true });

                const ticket = findUserTicket(interaction.guild, interaction.user.id);

                if (!ticket) {
                    return interaction.editReply("❌ Nemáš otevřený ticket.");
                }

                await interaction.editReply("🔒 Ticket se uzavře za 5 sekund");

                setTimeout(() => {
                    ticket.delete().catch(() => {});
                }, 5000);

                return;
            }

            // ===== SUGGEST COMMAND =====
            if (interaction.commandName === 'suggest') {

                const text = interaction.options.getString('text');
                const duration = parseTime(interaction.options.getString('time'));

                if (!duration) {
                    return interaction.reply({
                        content: "❌ Invalid time format. Use: 10m, 1h, 2d, 30s",
                        ephemeral: true
                    });
                }

                const embed = new EmbedBuilder()
                    .setTitle("📢 Nový návrh")
                    .setDescription(text)
                    .addFields(
                        { name: "👍 Ano", value: "0", inline: true },
                        { name: "👎 Ne", value: "0", inline: true }
                    )
                    .setColor(0x5865F2);

                const yesBtn = new ButtonBuilder()
                    .setCustomId("vote_yes")
                    .setLabel("👍 Yes")
                    .setStyle(ButtonStyle.Success);

                const noBtn = new ButtonBuilder()
                    .setCustomId("vote_no")
                    .setLabel("👎 No")
                    .setStyle(ButtonStyle.Danger);

                const message = await interaction.reply({
                    embeds: [embed],
                    components: [new ActionRowBuilder().addComponents(yesBtn, noBtn)],
                    fetchReply: true
                });

                activePolls.set(message.id, { yes: new Set(), no: new Set() });

                setTimeout(async () => {

                    const poll = activePolls.get(message.id);
                    if (!poll) return;

                    const finalEmbed = new EmbedBuilder()
                        .setTitle("📊 Poll Ended")
                        .setDescription(text)
                        .addFields(
                            { name: "👍 Yes", value: `${poll.yes.size}`, inline: true },
                            { name: "👎 No", value: `${poll.no.size}`, inline: true }
                        )
                        .setColor(0x00FF99);

                    const disabledRow = new ActionRowBuilder().addComponents(
                        ButtonBuilder.from(yesBtn).setDisabled(true),
                        ButtonBuilder.from(noBtn).setDisabled(true)
                    );

                    await message.edit({
                        embeds: [finalEmbed],
                        components: [disabledRow]
                    });

                    const voters = [...new Set([...poll.yes, ...poll.no])];

                    if (voters.length > 0) {
                        const mentions = voters.map(id => `<@${id}>`).join(' ');
                        await message.channel.send(`📢 Poll ended! Thanks for voting: ${mentions}`);
                    }

                    activePolls.delete(message.id);

                }, duration);

                return;
            }
        }

        // ================= SELECT MENU =================
if (interaction.isStringSelectMenu()) {

    if (interaction.customId !== "select_ticket_type") return;

    await interaction.deferReply({ ephemeral: true });
const settings = await getSettings();
const staffRoleId = settings.staffRole || process.env.STAFF_ROLE_ID;
    try {

        if (findUserTicket(interaction.guild, interaction.user.id)) {
            return interaction.editReply({
                content: "❌ You already have an open ticket."
            });
        }

        const type = interaction.values[0];
        const count = await incrementTicketCount();

        let category = interaction.guild.channels.cache.find(
            c => c.name === "Tickets" && c.type === ChannelType.GuildCategory
        );

        if (!category) {
            category = await interaction.guild.channels.create({
                name: "Tickets",
                type: ChannelType.GuildCategory
            });
        }

        const permissionOverwrites = [
            {
                id: interaction.guild.id,
                deny: [PermissionsBitField.Flags.ViewChannel]
            },
            {
                id: interaction.user.id,
                allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.SendMessages
                ]
            },
            {
                id: interaction.guild.members.me.id,
                allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.SendMessages
                ]
            }
        ];

        // Only add staff role if it exists
        if (staffRoleId) {
            permissionOverwrites.push({
                id: staffRoleId,
                allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.SendMessages
                ]
            });
        }

        const channel = await interaction.guild.channels.create({
            name: `${type}-${interaction.user.username}`
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, ''),
            parent: category.id,
            permissionOverwrites
        });

        const claimBtn = new ButtonBuilder()
            .setCustomId("claim_ticket")
            .setLabel("Claim Ticket")
            .setStyle(ButtonStyle.Success);

        const closeBtn = new ButtonBuilder()
            .setCustomId("close_ticket")
            .setLabel("Close Ticket")
            .setStyle(ButtonStyle.Danger);

        const embed = new EmbedBuilder()
            .setTitle(`🎟 Ticket #${count}`)
            .setDescription(
                `Type: **${type}**\nOpened by: ${interaction.user}\n\nClaimed by: ❌ Not claimed`
            )
            .setColor(0x00FF99);

        await channel.send({
    content: staffRoleId ? `<@&${staffRoleId}> New ticket opened!` : null,
            embeds: [embed],
            components: [new ActionRowBuilder().addComponents(claimBtn, closeBtn)],
            allowedMentions: staffRoleId ? { roles: [staffRoleId] } : {}
        });

        return interaction.editReply(`✅ Ticket created: ${channel}`);

    } catch (err) {
        console.error("Ticket error:", err);
        return interaction.editReply("❌ Failed to create ticket. Check bot permissions.");
    }
}

        // ================= BUTTONS =================
        if (interaction.isButton()) {

            // Close Ticket Button
            if (interaction.customId === "close_ticket") {
                await interaction.reply("🔒 Closing ticket in 5 seconds...");
                setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
                return;
            }

            // Claim Ticket Button
if (interaction.customId === "claim_ticket") {

    const settings = await getSettings();
    const staffRoleId = settings.staffRole || process.env.STAFF_ROLE_ID;

    if (!staffRoleId || !interaction.member.roles.cache.has(staffRoleId)) {
        return interaction.reply({
            content: "❌ Only staff can claim tickets.",
            ephemeral: true
        });
    }

    const embed = EmbedBuilder.from(interaction.message.embeds[0]);

    embed.setDescription(
        embed.data.description.replace(
            "❌ Not claimed",
            `✅ Claimed by ${interaction.user}`
        )
    );

    return interaction.update({
        embeds: [embed]
    });
}

            // Voting Buttons
            const poll = activePolls.get(interaction.message.id);
            if (!poll) return;

            if (interaction.customId === "vote_yes") {
                poll.no.delete(interaction.user.id);
                poll.yes.add(interaction.user.id);
            }

            if (interaction.customId === "vote_no") {
                poll.yes.delete(interaction.user.id);
                poll.no.add(interaction.user.id);
            }

            const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .setFields(
                    { name: "👍 Yes", value: `${poll.yes.size}`, inline: true },
                    { name: "👎 No", value: `${poll.no.size}`, inline: true }
                );

            await interaction.update({ embeds: [updatedEmbed] });
        }


// ===== 8BALL =====
if (interaction.commandName === '8ball') {
    const responses = [
        // ✅ EDIT THESE RESPONSES HOWEVER YOU LIKE
        "Je to jasne.",
        "bezpochyby",
        "Ano, urcite.",
        "s největší pravděpodobností.",
        "rekl bych ze ano",
        "Odpověď mlhavá, zkuste to znovu.",
        "Zeptej se znovu pozdeji",
        "Nyni nemuzu predpovedet",
        "Nepocitej s tim",
        "Moje odpoved zni ne",
        "velice pochybne",
        "Výhled není moc dobrý."
    ];
    const question = interaction.options.getString('question');
    const answer = responses[Math.floor(Math.random() * responses.length)];
    return interaction.reply(`🎱 **${question}**\n${answer}`);
}

// ===== FUN COMMANDS =====
if (interaction.commandName === 'baldi') {
    return interaction.reply('Nevim euhh');
}

if (interaction.commandName === 'lukasz') {
    return interaction.reply('https://tenor.com/view/swedish-gif-18685828');
}

if (interaction.commandName === 'baf') {
    return interaction.reply('AAAAAAAAAAAAAAAAA');
}

if (interaction.commandName === 'koika') {
    return interaction.reply('MŇAU MŇAU uspokojive vrneni');
}

// ===== SETYOUTUBE =====
if (interaction.commandName === 'setyoutube') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ content: "Admin only.", ephemeral: true });
    }
    const channel = interaction.options.getChannel('channel');
    const role1 = interaction.options.getRole('role1');
    const role2 = interaction.options.getRole('role2');

    await database.collection("config").updateOne(
        { name: "youtube" },
        { $set: {
            channelId: channel.id,
            role1: role1.id,
            role2: role2.id
        }},
        { upsert: true }
    );
    return interaction.reply({ content: `YouTube announcements will be posted in ${channel}`, ephemeral: true });
}
    // new commands before this
} catch (err) {
        console.error(err);
        if (!interaction.replied && !interaction.deferred) {
            interaction.reply({ content: "❌ An error occurred.", ephemeral: true }).catch(() => {});
        }
    }
});
// ================= START =================
(async () => {
    await connectDB();
    await registerCommands();
    await client.login(token);
    app.listen(3000, () => console.log('Web server running on port 3000'));
})();
