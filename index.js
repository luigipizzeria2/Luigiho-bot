require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    SlashCommandBuilder,
    REST,
    Routes,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    PermissionFlagsBits
} = require("discord.js");

const { MongoClient } = require("mongodb");
const express = require("express");

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const mongoUri = process.env.MONGO_URI;

if (!token || !clientId || !mongoUri) {
    console.error("❌ Missing values in .env file.");
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds
    ]
});


const app = express();
let database;

// ================= DATABASE =================

async function connectDB() {
    const mongo = new MongoClient(mongoUri);
    await mongo.connect();
    database = mongo.db("luigihoBot");
    console.log("✅ Connected to MongoDB");
}

async function getGuildConfig(guildId) {
    return await database.collection("configs").findOne({ guildId });
}

async function updateGuildConfig(guildId, data) {
    await database.collection("configs").updateOne(
        { guildId },
        { $set: data },
        { upsert: true }
    );
}

async function incrementTicketCount(guildId) {
    const result = await database.collection("counters").findOneAndUpdate(
        { guildId },
        { $inc: { value: 1 } },
        { upsert: true, returnDocument: "after" }
    );
    return result.value.value;
}

// ================= SLASH COMMANDS =================

async function registerCommands() {
    const commands = [

        new SlashCommandBuilder()
            .setName("setup")
            .setDescription("Configure bot for this server"),

        new SlashCommandBuilder()
            .setName("ticketpanel")
            .setDescription("Send the ticket panel"),

        new SlashCommandBuilder()
            .setName("close")
            .setDescription("Close your open ticket"),

        new SlashCommandBuilder()
            .setName("suggest")
            .setDescription("Create a suggestion poll")
            .addStringOption(opt =>
                opt.setName("text")
                    .setDescription("Suggestion text")
                    .setRequired(true)
            )
            .addStringOption(opt =>
                opt.setName("time")
                    .setDescription("Time (10m, 1h, 1d)")
                    .setRequired(true)
            )

    ].map(c => c.toJSON());

    const rest = new REST({ version: "10" }).setToken(token);

    await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands }
    );

    console.log("🌍 Global slash commands registered.");
}

// ================= BOT EVENTS =================

client.once("clientReady", () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on("interactionCreate", async interaction => {
    if (interaction.isChatInputCommand()) {

        const guildId = interaction.guild.id;
        const config = await getGuildConfig(guildId) || {};

        // SETUP
        if (interaction.commandName === "setup") {
            const embed = new EmbedBuilder()
                .setTitle("⚙️ Server Setup")
                .setDescription("Toggle features and set staff role.")
                .setColor(0x5865F2);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("toggle_tickets")
                    .setLabel("🎟 Toggle Tickets")
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId("toggle_suggestions")
                    .setLabel("📢 Toggle Suggestions")
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId("set_staff")
                    .setLabel("👮 Set Staff Role")
                    .setStyle(ButtonStyle.Secondary)
            );

            return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        }

        // TICKET PANEL
        if (interaction.commandName === "ticketpanel") {

            if (!config.ticketsEnabled)
                return interaction.reply({ content: "❌ Tickets are disabled.", ephemeral: true });

            const embed = new EmbedBuilder()
                .setTitle("🎟 Open a Ticket")
                .setDescription("Click below to open a ticket.")
                .setColor(0x5865F2);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("open_ticket")
                    .setLabel("Open Ticket")
                    .setStyle(ButtonStyle.Success)
            );

            return interaction.reply({ embeds: [embed], components: [row] });
        }

        // CLOSE COMMAND
        if (interaction.commandName === "close") {

            const channel = interaction.guild.channels.cache.find(c =>
                c.name === `ticket-${interaction.user.id}`
            );

            if (!channel)
                return interaction.reply({ content: "❌ You do not have an open ticket.", ephemeral: true });

            await channel.delete();
            return interaction.reply({ content: "✅ Ticket closed.", ephemeral: true });
        }

        // SUGGEST
        if (interaction.commandName === "suggest") {

            if (!config.suggestionsEnabled)
                return interaction.reply({ content: "❌ Suggestions are disabled.", ephemeral: true });

            const text = interaction.options.getString("text");
            const time = interaction.options.getString("time");

            const embed = new EmbedBuilder()
                .setTitle("📢 New Suggestion")
                .setDescription(text)
                .setColor(0x5865F2)
                .setFooter({ text: `Ends in ${time}` });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("vote_yes")
                    .setLabel("👍 Yes")
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId("vote_no")
                    .setLabel("👎 No")
                    .setStyle(ButtonStyle.Danger)
            );

            return interaction.reply({ embeds: [embed], components: [row] });
        }
    }

    // BUTTONS
    if (interaction.isButton()) {

        const guildId = interaction.guild.id;
        const config = await getGuildConfig(guildId) || {};

        // Toggle Tickets
        if (interaction.customId === "toggle_tickets") {
            await updateGuildConfig(guildId, { ticketsEnabled: !config.ticketsEnabled });
            return interaction.reply({ content: `Tickets: ${!config.ticketsEnabled ? "Enabled" : "Disabled"}`, ephemeral: true });
        }

        // Toggle Suggestions
        if (interaction.customId === "toggle_suggestions") {
            await updateGuildConfig(guildId, { suggestionsEnabled: !config.suggestionsEnabled });
            return interaction.reply({ content: `Suggestions: ${!config.suggestionsEnabled ? "Enabled" : "Disabled"}`, ephemeral: true });
        }

        // Set Staff Role
        if (interaction.customId === "set_staff") {
            await interaction.reply({ content: "Mention the staff role now.", ephemeral: true });
        }

        // Open Ticket
        if (interaction.customId === "open_ticket") {

            const existing = interaction.guild.channels.cache.find(c =>
                c.name === `ticket-${interaction.user.id}`
            );

            if (existing)
                return interaction.reply({ content: "❌ You already have an open ticket.", ephemeral: true });

            const count = await incrementTicketCount(guildId);

            const category = await interaction.guild.channels.create({
                name: `ticket-${interaction.user.id}`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    {
                        id: interaction.guild.roles.everyone,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: interaction.user.id,
                        allow: [PermissionFlagsBits.ViewChannel]
                    }
                ]
            });

            return interaction.reply({ content: `✅ Ticket created: ${category}`, ephemeral: true });
        }
    }
});

// ================= WEBSITE =================

app.get("/", (req, res) => {
    res.send(`
    <html>
    <head>
    <title>Luigiho Bot</title>
    <style>
    body { background:#0f172a; color:white; font-family:Arial; text-align:center; padding:100px; }
    .btn { padding:15px 30px; background:#5865F2; color:white; text-decoration:none; border-radius:8px; margin:10px; display:inline-block; }
    .status { margin:20px; }
    </style>
    </head>
    <body>
    <h1>Luigiho Bot</h1>
    <div class="status" id="status">Checking status...</div>
    <a class="btn" href="https://discord.com/oauth2/authorize?client_id=1473059410002575371&permissions=27664&integration_type=0&scope=bot+applications.commands" target="_blank">Add to Discord</a>
    <a class="btn" href="/commands">Commands</a>
    <a class="btn" href="https://discord.gg/FmPjQxGHFv" target="_blank">Support Server</a>
    <script>
    fetch('/api/status').then(r=>r.json()).then(d=>{
        document.getElementById('status').innerText =
        d.online ? "🟢 Online • Serving " + d.servers + " servers" : "🔴 Offline";
    });
    </script>
    </body>
    </html>
    `);
});

app.get("/commands", (req, res) => {
    res.send(`
    <html><body style="background:#0f172a;color:white;font-family:Arial;padding:50px;">
    <h1>Commands</h1>
    <p>/setup</p>
    <p>/ticketpanel</p>
    <p>/close</p>
    <p>/suggest</p>
    <a href="/">Back</a>
    </body></html>
    `);
});

app.get("/api/status", (req, res) => {
    res.json({
        online: client.isReady(),
        servers: client.guilds.cache.size
    });
});


// ================= START =================

(async () => {
    await connectDB();
    await registerCommands();
    await client.login(token);

 app.listen(3000, "0.0.0.0", () => {
    console.log("🌐 Web server running");
});


})();
