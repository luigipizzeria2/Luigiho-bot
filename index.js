require('dotenv').config();
const express = require('express');
const app = express();

app.get('/', (req, res) => res.send('Bot is running'));
app.listen(3000, () => console.log('Web server running'));

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
    StringSelectMenuBuilder,
    RoleSelectMenuBuilder
} = require('discord.js');

const { MongoClient } = require('mongodb');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const mongoURI = process.env.MONGO_URI;

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

let database;
const activePolls = new Map();

// ================= DATABASE =================
async function connectDB() {
    const mongo = new MongoClient(mongoURI);
    await mongo.connect();
    database = mongo.db("multiBot");
    console.log("✅ Connected to MongoDB");
}

async function getGuildConfig(guildId) {
    let config = await database.collection("guildConfigs").findOne({ guildId });
    if (!config) {
        config = {
            guildId,
            ticketsEnabled: false,
            suggestionsEnabled: false,
            staffRoleId: null
        };
        await database.collection("guildConfigs").insertOne(config);
    }
    return config;
}

async function updateGuildConfig(guildId, update) {
    await database.collection("guildConfigs").updateOne(
        { guildId },
        { $set: update },
        { upsert: true }
    );
}

async function incrementTicketCount(guildId) {
    const result = await database.collection("ticketCounters").findOneAndUpdate(
        { guildId },
        { $inc: { value: 1 } },
        { upsert: true, returnDocument: "after" }
    );
    return result.value.value;
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

// ================= REGISTER GLOBAL COMMANDS =================
async function registerCommands() {

    const commands = [

        new SlashCommandBuilder()
            .setName('setup')
            .setDescription('Setup bot for this server')
            .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

        new SlashCommandBuilder()
            .setName('ticketpanel')
            .setDescription('Send the ticket panel'),

        new SlashCommandBuilder()
            .setName('close')
            .setDescription('Close your ticket'),

        new SlashCommandBuilder()
            .setName('suggest')
            .setDescription('Create a suggestion poll')
            .addStringOption(option =>
                option.setName('text').setDescription('Suggestion').setRequired(true)
            )
            .addStringOption(option =>
                option.setName('time').setDescription('10m, 1h, 1d').setRequired(true)
            )

    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: '10' }).setToken(token);

    await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands }
    );

    console.log("🌍 Global slash commands registered.");
}

client.once('clientReady', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
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

        if (!interaction.inGuild()) return;

        const config = await getGuildConfig(interaction.guild.id);

        // ================= SLASH COMMANDS =================
        if (interaction.isChatInputCommand()) {

            // ===== SETUP =====
            if (interaction.commandName === 'setup') {

                const embed = new EmbedBuilder()
                    .setTitle("⚙️ Bot Setup")
                    .setDescription("Enable features and set staff role.")
                    .setColor(0x5865F2);

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("enable_tickets")
                        .setLabel("🎟 Toggle Tickets")
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId("enable_suggestions")
                        .setLabel("📢 Toggle Suggestions")
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId("set_staff_role")
                        .setLabel("👮 Set Staff Role")
                        .setStyle(ButtonStyle.Success)
                );

                return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
            }

            // ===== TICKET PANEL =====
            if (interaction.commandName === 'ticketpanel') {

                if (!config.ticketsEnabled)
                    return interaction.reply({ content: "❌ Tickets not enabled.", ephemeral: true });

                if (!config.staffRoleId)
                    return interaction.reply({ content: "❌ Staff role not set. Use /setup.", ephemeral: true });

                if (findUserTicket(interaction.guild, interaction.user.id))
                    return interaction.reply({ content: "❌ You already have a ticket.", ephemeral: true });

                const embed = new EmbedBuilder()
                    .setTitle("🎟 Open a Ticket")
                    .setDescription("Choose a type.")
                    .setColor(0x5865F2);

                const select = new StringSelectMenuBuilder()
                    .setCustomId("ticket_type")
                    .addOptions([
                        { label: "Minecraft Help", value: "minecraft" },
                        { label: "Suggestion", value: "suggestion" },
                        { label: "Need Help", value: "help" },
                        { label: "YouTube Collab", value: "youtube" }
                    ]);

                return interaction.reply({
                    embeds: [embed],
                    components: [new ActionRowBuilder().addComponents(select)]
                });
            }

            // ===== CLOSE =====
            if (interaction.commandName === 'close') {

                const ticket = findUserTicket(interaction.guild, interaction.user.id);
                if (!ticket)
                    return interaction.reply({ content: "❌ No open ticket.", ephemeral: true });

                await interaction.reply("🔒 Closing in 5 seconds...");
                setTimeout(() => ticket.delete().catch(() => {}), 5000);
                return;
            }

            // ===== SUGGEST =====
            if (interaction.commandName === 'suggest') {

                if (!config.suggestionsEnabled)
                    return interaction.reply({ content: "❌ Suggestions not enabled.", ephemeral: true });

                const text = interaction.options.getString('text');
                const duration = parseTime(interaction.options.getString('time'));

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

                const yes = new ButtonBuilder().setCustomId("vote_yes").setLabel("👍 Yes").setStyle(ButtonStyle.Success);
                const no = new ButtonBuilder().setCustomId("vote_no").setLabel("👎 No").setStyle(ButtonStyle.Danger);

                const message = await interaction.reply({
                    embeds: [embed],
                    components: [new ActionRowBuilder().addComponents(yes, no)],
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

                    await message.edit({
                        embeds: [finalEmbed],
                        components: [new ActionRowBuilder().addComponents(
                            ButtonBuilder.from(yes).setDisabled(true),
                            ButtonBuilder.from(no).setDisabled(true)
                        )]
                    });

                    activePolls.delete(message.id);

                }, duration);

                return;
            }
        }

        // ================= BUTTONS =================
        if (interaction.isButton()) {

            // Setup Buttons
            if (interaction.customId === "enable_tickets") {
                await updateGuildConfig(interaction.guild.id, { ticketsEnabled: !config.ticketsEnabled });
                return interaction.reply({ content: `🎟 Tickets toggled!`, ephemeral: true });
            }

            if (interaction.customId === "enable_suggestions") {
                await updateGuildConfig(interaction.guild.id, { suggestionsEnabled: !config.suggestionsEnabled });
                return interaction.reply({ content: `📢 Suggestions toggled!`, ephemeral: true });
            }

            if (interaction.customId === "set_staff_role") {
                const select = new RoleSelectMenuBuilder()
                    .setCustomId("staff_role_select")
                    .setPlaceholder("Select staff role")
                    .setMinValues(1)
                    .setMaxValues(1);

                return interaction.reply({
                    content: "Select the staff role:",
                    components: [new ActionRowBuilder().addComponents(select)],
                    ephemeral: true
                });
            }

            // Voting
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

        // ================= ROLE SELECT =================
        if (interaction.isRoleSelectMenu()) {
            const roleId = interaction.values[0];
            await updateGuildConfig(interaction.guild.id, { staffRoleId: roleId });
            return interaction.reply({ content: "👮 Staff role saved!", ephemeral: true });
        }

    } catch (err) {
        console.error(err);
    }
});

// ================= START =================
(async () => {
    await connectDB();
    await registerCommands();
    await client.login(token);
})();
