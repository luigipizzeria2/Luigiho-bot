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
    PermissionFlagsBits,
    StringSelectMenuBuilder
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
    intents: [GatewayIntentBits.Guilds]
});

const app = express();
let database;
const activePolls = new Map();

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
            .setDescription("Configure bot for this server")
            .addRoleOption(opt =>
                opt.setName("staff")
                    .setDescription("Select staff role")
                    .setRequired(true)
            ),

        new SlashCommandBuilder()
            .setName("ticketpanel")
            .setDescription("Create a custom ticket panel")
            .addStringOption(option =>
                option.setName("types")
                    .setDescription("Separate types with ; (Example: Support; Ideas; Help)")
                    .setRequired(true)
            ),

        new SlashCommandBuilder()
            .setName("close")
            .setDescription("Close this ticket"),

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

            const staffRole = interaction.options.getRole("staff");

            await updateGuildConfig(guildId, {
                staffRoleId: staffRole.id,
                ticketsEnabled: true,
                suggestionsEnabled: true
            });

            return interaction.reply({
                content: `✅ Setup complete.\nStaff role set to ${staffRole}.`,
                ephemeral: true
            });
        }

        // TICKET PANEL
        if (interaction.commandName === "ticketpanel") {

            if (!config.ticketsEnabled)
                return interaction.reply({ content: "❌ Tickets disabled.", ephemeral: true });

            const types = interaction.options.getString("types")
                .split(";")
                .map(t => t.trim())
                .filter(Boolean);

            await updateGuildConfig(guildId, { ticketTypes: types });

            const embed = new EmbedBuilder()
                .setTitle("🎟 Open a Ticket")
                .setDescription("Select a ticket type.")
                .setColor(0x5865F2);

            const menu = new StringSelectMenuBuilder()
                .setCustomId("ticket_type_select")
                .setPlaceholder("Choose ticket type")
                .addOptions(
                    types.map((t, i) => ({
                        label: t,
                        value: i.toString()
                    }))
                );

            return interaction.reply({
                embeds: [embed],
                components: [new ActionRowBuilder().addComponents(menu)]
            });
        }

        // CLOSE
        if (interaction.commandName === "close") {

            if (!interaction.channel.name.startsWith("ticket-"))
                return interaction.reply({ content: "❌ Not a ticket channel.", ephemeral: true });

            await interaction.reply("🔒 Closing ticket...");
            setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
        }

        // SUGGEST
        if (interaction.commandName === "suggest") {

            if (!config.suggestionsEnabled)
                return interaction.reply({ content: "❌ Suggestions disabled.", ephemeral: true });

            const text = interaction.options.getString("text");
            const duration = parseTime(interaction.options.getString("time"));

            if (!duration)
                return interaction.reply({ content: "❌ Invalid time format.", ephemeral: true });

            const embed = new EmbedBuilder()
                .setTitle("📢 New Suggestion")
                .setDescription(text)
                .addFields(
                    { name: "👍 Yes", value: "0", inline: true },
                    { name: "👎 No", value: "0", inline: true }
                )
                .setColor(0x5865F2);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("vote_yes").setLabel("👍 Yes").setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId("vote_no").setLabel("👎 No").setStyle(ButtonStyle.Danger)
            );

            const message = await interaction.reply({
                embeds: [embed],
                components: [row],
                fetchReply: true
            });

            activePolls.set(message.id, { yes: new Set(), no: new Set() });

            setTimeout(async () => {

                const poll = activePolls.get(message.id);
                if (!poll) return;

                const voters = [...poll.yes, ...poll.no];

                const finalEmbed = new EmbedBuilder()
                    .setTitle("📊 Poll Ended")
                    .setDescription(text)
                    .addFields(
                        { name: "👍 Yes", value: `${poll.yes.size}`, inline: true },
                        { name: "👎 No", value: `${poll.no.size}`, inline: true }
                    )
                    .setColor(0x22c55e);

                await message.edit({ embeds: [finalEmbed], components: [] });

                if (voters.length > 0) {
                    await message.channel.send(
                        voters.map(id => `<@${id}>`).join(" ")
                    );
                }

                activePolls.delete(message.id);

            }, duration);
        }
    }

    // SELECT MENU (TICKETS)
    if (interaction.isStringSelectMenu()) {

        if (interaction.customId === "ticket_type_select") {

            const config = await getGuildConfig(interaction.guild.id);
            const selectedIndex = parseInt(interaction.values[0]);
            const typeName = config.ticketTypes[selectedIndex];

            const count = await incrementTicketCount(interaction.guild.id);

            const channel = await interaction.guild.channels.create({
                name: `ticket-${count}-${typeName.toLowerCase().replace(/\s+/g, "-")}`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: interaction.guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel] },
                    { id: config.staffRoleId, allow: [PermissionFlagsBits.ViewChannel] }
                ]
            });

            const claimButton = new ButtonBuilder()
                .setCustomId("claim_ticket")
                .setLabel("Claim Ticket")
                .setStyle(ButtonStyle.Primary);

            await channel.send({
                content: `<@&${config.staffRoleId}>`,
                components: [new ActionRowBuilder().addComponents(claimButton)]
            });

            return interaction.reply({ content: `✅ Ticket created: ${channel}`, ephemeral: true });
        }
    }

    // BUTTONS
    if (interaction.isButton()) {

        if (interaction.customId === "claim_ticket") {

            await interaction.reply({
                content: `🎟 Ticket claimed by ${interaction.user}`,
                allowedMentions: { parse: [] }
            });

            await interaction.message.edit({ components: [] });
        }

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

        const embed = EmbedBuilder.from(interaction.message.embeds[0])
            .setFields(
                { name: "👍 Yes", value: `${poll.yes.size}`, inline: true },
                { name: "👎 No", value: `${poll.no.size}`, inline: true }
            );

        await interaction.update({ embeds: [embed] });
    }
});

// ================= WEBSITE =================

app.get("/", (req, res) => {
    res.send(`
    <html>
    <head>
        <title>Luigiho Bot</title>
        <style>
            body {
                background:#0f172a;
                color:white;
                font-family:Arial;
                text-align:center;
                padding:100px;
            }
            .btn {
                padding:15px 30px;
                background:#5865F2;
                color:white;
                text-decoration:none;
                border-radius:8px;
                margin:10px;
                display:inline-block;
                font-weight:bold;
            }
            .status {
                margin:20px;
                font-size:18px;
            }
        </style>
    </head>
    <body>
        <h1>Luigiho Bot</h1>

        <div class="status" id="status">
            Checking status...
        </div>

        <a class="btn"
           href="https://discord.com/oauth2/authorize?client_id=1473059410002575371&permissions=8&scope=bot%20applications.commands"
           target="_blank">
           Add to Discord
        </a>

        <a class="btn" href="/commands">
           Commands
        </a>

        <a class="btn"
           href="https://discord.gg/FmPjQxGHFv"
           target="_blank">
           Support Server
        </a>

        <script>
            fetch('/api/status')
            .then(r => r.json())
            .then(d => {
                document.getElementById('status').innerText =
                    d.online
                        ? "🟢 Online • Serving " + d.servers + " servers"
                        : "🔴 Offline";
            });
        </script>
    </body>
    </html>
    `);
});

app.get("/commands", (req, res) => {
    res.send(`
    <html>
    <body style="background:#0f172a;color:white;font-family:Arial;padding:50px;">
        <h1>Commands</h1>
        <p><b>/setup</b> – Configure staff role</p>
        <p><b>/ticketpanel</b> – Create custom ticket panel</p>
        <p><b>/close</b> – Close ticket</p>
        <p><b>/suggest</b> – Create suggestion poll</p>
        <br>
        <a href="/" style="color:#5865F2;">Back</a>
    </body>
    </html>
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