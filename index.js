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
const settings = await getSettings();
const staffRoleId = settings.staffRole || process.env.STAFF_ROLE_ID;
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
            )

    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: '10' }).setToken(token);

    await rest.put(
    Routes.applicationCommands(clientId),
    { body: [] }
);

    await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands }
    );

    console.log("Slash commands registered.");
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

        // ================= SLASH COMMANDS =================
        if (interaction.isChatInputCommand()) {
            const settings = await getSettings();
const disabled = settings.disabled || [];

if (disabled.includes(interaction.commandName)) {
    return interaction.reply({
        content: "❌ This command is disabled.",
        ephemeral: true
    });
}

            // ==== SETUP ====
         if (interaction.commandName === 'setup') {

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({
            content: "❌ Admin only.",
            ephemeral: true
        });
    }

    const role = interaction.options.getRole('staffrole');
    const enable = interaction.options.getString('enable');
    const disable = interaction.options.getString('disable');

    let update = {};

    if (role) update.staffRole = role.id;

    if (enable) {
        update.$pull = { disabled: enable };
    }

    if (disable) {
        update.$addToSet = { disabled: disable };
    }

    await database.collection("config").updateOne(
        { name: "settings" },
        update,
        { upsert: true }
    );

    return interaction.reply({
        content: "✅ Settings updated.",
        ephemeral: true
    });
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
                    return interaction.editReply("❌ You do not have an open ticket.");
                }

                await interaction.editReply("🔒 Closing ticket in 5 seconds...");

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
                    .setTitle("📢 New Suggestion")
                    .setDescription(text)
                    .addFields(
                        { name: "👍 Yes", value: "0", inline: true },
                        { name: "👎 No", value: "0", inline: true }
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
            name: `${type}-${count}`,
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
            content: staffRoleId ? `<@&${staffRoleId}>` : null,
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