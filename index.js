const express = require('express');
const app = express();

app.get('/', (req, res) => {
    res.send('Bot is running');
});

app.listen(3000, () => {
    console.log('Web server running');
});
require('dotenv').config();

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
    ChannelType
} = require('discord.js');

const { MongoClient } = require('mongodb');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
const staffRoleId = process.env.STAFF_ROLE_ID;
const mongoURI = process.env.MONGO_URI;

if (!token || !clientId || !guildId || !staffRoleId || !mongoURI) {
    console.log("❌ Missing environment variables.");
    process.exit(1);
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

let database;
let openTickets = new Map();

// ===== CONNECT TO MONGODB =====
async function connectDB() {
    const mongo = new MongoClient(mongoURI);
    await mongo.connect();
    database = mongo.db("ticketBot");
    console.log("✅ Connected to MongoDB");
}

// ===== GET COUNTER =====
async function getTicketCount() {
    const data = await database.collection("config").findOne({ name: "counter" });
    if (!data) {
        await database.collection("config").insertOne({ name: "counter", value: 0 });
        return 0;
    }
    return data.value;
}

// ===== INCREMENT COUNTER =====
async function incrementTicketCount() {
    const result = await database.collection("config").findOneAndUpdate(
        { name: "counter" },
        { $inc: { value: 1 } },
        { upsert: true, returnDocument: "after" }
    );
    return result.value.value;
}

// ===== REGISTER COMMAND =====
async function registerCommands() {
    const commands = [
        new SlashCommandBuilder()
            .setName('ticketpanel')
            .setDescription('Send the support ticket panel')
    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: '10' }).setToken(token);
    await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands }
    );
    console.log("Slash commands registered.");
}

client.once('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {

    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'ticketpanel') {

            const count = await getTicketCount();

            const embed = new EmbedBuilder()
                .setTitle("🎟 Support Tickets")
                .setDescription("Click below to open a support ticket.")
                .setFooter({ text: `Total Tickets Created: ${count}` })
                .setColor(0x5865F2);

            const button = new ButtonBuilder()
                .setCustomId("create_ticket")
                .setLabel("Open Ticket")
                .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder().addComponents(button);

            await interaction.reply({
                embeds: [embed],
                components: [row]
            });
        }
    }

    if (interaction.isButton()) {

        if (interaction.customId === "create_ticket") {

            if (openTickets.has(interaction.user.id)) {
                return interaction.reply({ content: "❌ You already have a ticket.", ephemeral: true });
            }

            await interaction.deferReply({ ephemeral: true });

            const newCount = await incrementTicketCount();

            let category = interaction.guild.channels.cache.find(
                c => c.name === "Tickets" && c.type === ChannelType.GuildCategory
            );

            if (!category) {
                category = await interaction.guild.channels.create({
                    name: "Tickets",
                    type: ChannelType.GuildCategory
                });
            }

            const channel = await interaction.guild.channels.create({
                name: `ticket-${newCount}`,
                parent: category.id,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                    { id: staffRoleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                    { id: interaction.guild.members.me.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
                ]
            });

            openTickets.set(interaction.user.id, channel.id);

            const closeButton = new ButtonBuilder()
                .setCustomId("close_ticket")
                .setLabel("Close Ticket")
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder().addComponents(closeButton);

            await channel.send({
                content: `<@&${staffRoleId}>`,
                embeds: [
                    new EmbedBuilder()
                        .setTitle(`🎟 Ticket #${newCount}`)
                        .setDescription(`Welcome ${interaction.user}`)
                        .setColor(0x00FF99)
                ],
                components: [row],
                allowedMentions: { roles: [staffRoleId] }
            });

            await interaction.editReply({ content: `✅ Ticket created: ${channel}` });
        }
    }
});

(async () => {
    await connectDB();
    await registerCommands();
    await client.login(token);
})();
