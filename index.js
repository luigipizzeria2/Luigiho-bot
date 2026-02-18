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
    StringSelectMenuBuilder
} = require('discord.js');

const { MongoClient } = require('mongodb');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
const staffRoleId = process.env.STAFF_ROLE_ID;
const mongoURI = process.env.MONGO_URI;

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

let database;

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

// ================= REGISTER COMMANDS =================
async function registerCommands() {
    const commands = [
        new SlashCommandBuilder()
            .setName('ticketpanel')
            .setDescription('Send the support ticket panel'),

        new SlashCommandBuilder()
            .setName('close')
            .setDescription('Close your open ticket')
    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: '10' }).setToken(token);

    await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands }
    );

    console.log("Slash commands registered.");
}

client.once('clientReady', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

// ================= HELPER: FIND USER TICKET =================
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

        if (interaction.isChatInputCommand()) {

            // ---- /ticketpanel ----
            if (interaction.commandName === 'ticketpanel') {

                const existingTicket = findUserTicket(interaction.guild, interaction.user.id);

                if (existingTicket) {
                    return interaction.reply({
                        content: "❌ You already have an open ticket.",
                        ephemeral: true
                    });
                }

                const embed = new EmbedBuilder()
                    .setTitle("🎟 Open a Ticket")
                    .setDescription("Select the type of ticket below.")
                    .setColor(0x5865F2);

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId("select_ticket_type")
                    .setPlaceholder("Choose a ticket type")
                    .addOptions([
                        { label: "Minecraft Server Help", value: "minecraft", emoji: "🎮" },
                        { label: "Suggestion", value: "suggestion", emoji: "💡" },
                        { label: "Need Help", value: "help", emoji: "❓" },
                        { label: "YouTube Collab", value: "youtube", emoji: "🎥" }
                    ]);

                const row = new ActionRowBuilder().addComponents(selectMenu);

                return interaction.reply({
                    embeds: [embed],
                    components: [row]
                });
            }

            // ---- /close ----
            if (interaction.commandName === 'close') {

                await interaction.deferReply({ ephemeral: true });

                const ticketChannel = findUserTicket(interaction.guild, interaction.user.id);

                if (!ticketChannel) {
                    return interaction.editReply({
                        content: "❌ You do not have an open ticket."
                    });
                }

                await interaction.editReply({
                    content: `🔒 Closing your ticket: ${ticketChannel} in 5 seconds...`
                });

                setTimeout(() => {
                    ticketChannel.delete().catch(() => {});
                }, 5000);

                return;
            }
        }

        // ===== SELECT MENU =====
        if (interaction.isStringSelectMenu()) {

            if (interaction.customId !== "select_ticket_type") return;

            const existingTicket = findUserTicket(interaction.guild, interaction.user.id);

            if (existingTicket) {
                return interaction.reply({
                    content: "❌ You already have an open ticket.",
                    ephemeral: true
                });
            }

            await interaction.deferReply({ ephemeral: true });

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

            const channel = await interaction.guild.channels.create({
                name: `${type}-${count}`,
                parent: category.id,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                    { id: staffRoleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                    { id: interaction.guild.members.me.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
                ]
            });

            const closeButton = new ButtonBuilder()
                .setCustomId("close_ticket")
                .setLabel("Close Ticket")
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder().addComponents(closeButton);

            const embed = new EmbedBuilder()
                .setTitle(`🎟 Ticket #${count}`)
                .setDescription(`Type: **${type}**\nOpened by: ${interaction.user}`)
                .setColor(0x00FF99);

            await channel.send({
                content: `<@&${staffRoleId}>`,
                embeds: [embed],
                components: [row],
                allowedMentions: { roles: [staffRoleId] }
            });

            return interaction.editReply({
                content: `✅ Ticket created: ${channel}`
            });
        }

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
})();
