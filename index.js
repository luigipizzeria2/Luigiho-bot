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
let openTickets = new Map();

// ===== DATABASE =====
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

// ===== REGISTER SLASH COMMAND =====
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

// ===== INTERACTIONS =====
client.on(Events.InteractionCreate, async interaction => {

    // ===== SLASH COMMAND =====
    if (interaction.isChatInputCommand()) {

        if (interaction.commandName === 'ticketpanel') {

            const embed = new EmbedBuilder()
                .setTitle("🎟 Open a Ticket")
                .setDescription("Select the type of ticket below.")
                .setColor(0x5865F2);

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId("select_ticket_type")
                .setPlaceholder("Choose a ticket type")
                .addOptions([
                    {
                        label: "Minecraft Server Help",
                        value: "minecraft",
                        emoji: "🎮"
                    },
                    {
                        label: "Suggestion",
                        value: "suggestion",
                        emoji: "💡"
                    },
                    {
                        label: "Need Help",
                        value: "help",
                        emoji: "❓"
                    },
                    {
                        label: "YouTube Collab",
                        value: "youtube",
                        emoji: "🎥"
                    }
                ]);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await interaction.reply({
                embeds: [embed],
                components: [row]
            });
        }
    }

    // ===== SELECT MENU =====
    if (interaction.isStringSelectMenu()) {

        if (interaction.customId === "select_ticket_type") {

            if (openTickets.has(interaction.user.id)) {
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

            openTickets.set(interaction.user.id, channel.id);

            const closeButton = new ButtonBuilder()
                .setCustomId("close_ticket")
                .setLabel("Close Ticket")
                .setStyle(ButtonStyle.Danger);

            const claimButton = new ButtonBuilder()
                .setCustomId("claim_ticket")
                .setLabel("Claim Ticket")
                .setStyle(ButtonStyle.Success);

            const row = new ActionRowBuilder().addComponents(claimButton, closeButton);

            const embed = new EmbedBuilder()
                .setTitle(`🎟 Ticket #${count}`)
                .setDescription(`Type: **${type}**\nOpened by: ${interaction.user}\n\nClaimed by: ❌ Not claimed`)
                .setColor(0x00FF99);

            await channel.send({
                content: `<@&${staffRoleId}>`,
                embeds: [embed],
                components: [row],
                allowedMentions: { roles: [staffRoleId] }
            });

            await interaction.editReply({
                content: `✅ Ticket created: ${channel}`
            });
        }
    }

    // ===== CLAIM SYSTEM =====
    if (interaction.isButton() && interaction.customId === "claim_ticket") {

        if (!interaction.member.roles.cache.has(staffRoleId)) {
            return interaction.reply({
                content: "❌ Only staff can claim tickets.",
                ephemeral: true
            });
        }

        const embed = EmbedBuilder.from(interaction.message.embeds[0]);

        if (embed.data.description.includes("Not claimed")) {

            embed.setDescription(
                embed.data.description.replace(
                    "❌ Not claimed",
                    `${interaction.user}`
                )
            );

            await interaction.update({ embeds: [embed] });

        } else {
            await interaction.reply({
                content: "❌ Already claimed.",
                ephemeral: true
            });
        }
    }

    // ===== CLOSE =====
    if (interaction.isButton() && interaction.customId === "close_ticket") {

        await interaction.reply("🔒 Closing in 5 seconds...");

        setTimeout(() => {
            interaction.channel.delete().catch(console.error);
        }, 5000);
    }
});

(async () => {
    await connectDB();
    await registerCommands();
    await client.login(token);
})();
