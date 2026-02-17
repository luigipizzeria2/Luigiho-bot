require('dotenv').config();
const fs = require('fs');

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

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
const staffRoleId = process.env.STAFF_ROLE_ID;

if (!token || !clientId || !guildId || !staffRoleId) {
    console.log("❌ Missing values in .env file.");
    process.exit(1);
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// ===== SIMPLE DATABASE =====

function getTicketData() {
    const raw = fs.readFileSync('./data.json');
    return JSON.parse(raw);
}

function saveTicketData(data) {
    fs.writeFileSync('./data.json', JSON.stringify(data, null, 2));
}

const openTickets = new Map(); // userId -> channelId


// ================= REGISTER SLASH COMMAND =================

async function registerCommands() {
    const commands = [
        new SlashCommandBuilder()
            .setName('ticketpanel')
            .setDescription('Send the support ticket panel')
    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: '10' }).setToken(token);

    console.log("Registering slash commands...");
    await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands }
    );
    console.log("Slash commands registered.");
}


// ================= READY =================

client.once('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});


// ================= INTERACTIONS =================

client.on(Events.InteractionCreate, async interaction => {

    // ===== SLASH COMMAND =====
    if (interaction.isChatInputCommand()) {

        if (interaction.commandName === 'ticketpanel') {

            const data = getTicketData();

            const embed = new EmbedBuilder()
                .setTitle("🎟 Support Tickets")
                .setDescription("Click below to open a support ticket.")
                .setColor(0x5865F2)
                .setFooter({ text: `Total Tickets Created: ${data.ticketCount}` });

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

    // ===== BUTTON HANDLING =====
    if (interaction.isButton()) {

        // ===== CREATE TICKET =====
        if (interaction.customId === "create_ticket") {

            if (openTickets.has(interaction.user.id)) {
                return interaction.reply({
                    content: "❌ You already have an open ticket.",
                    ephemeral: true
                });
            }

            await interaction.deferReply({ ephemeral: true });

            try {
                const data = getTicketData();
                data.ticketCount++;
                saveTicketData(data);

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
                    name: `ticket-${data.ticketCount}`,
                    type: ChannelType.GuildText,
                    parent: category.id,
                    permissionOverwrites: [
                        {
                            id: interaction.guild.id,
                            deny: [PermissionsBitField.Flags.ViewChannel],
                        },
                        {
                            id: interaction.user.id,
                            allow: [
                                PermissionsBitField.Flags.ViewChannel,
                                PermissionsBitField.Flags.SendMessages
                            ],
                        },
                        {
                            id: staffRoleId,
                            allow: [
                                PermissionsBitField.Flags.ViewChannel,
                                PermissionsBitField.Flags.SendMessages
                            ],
                        },
                        {
                            id: interaction.guild.members.me.id,
                            allow: [
                                PermissionsBitField.Flags.ViewChannel,
                                PermissionsBitField.Flags.SendMessages
                            ],
                        },
                    ],
                });

                openTickets.set(interaction.user.id, channel.id);

                const embed = new EmbedBuilder()
                    .setTitle(`🎟 Ticket #${data.ticketCount}`)
                    .setDescription(`Welcome ${interaction.user}!\nA staff member will assist you shortly.\n\nClaimed by: ❌ Not claimed`)
                    .setColor(0x00FF99);

                const closeButton = new ButtonBuilder()
                    .setCustomId("close_ticket")
                    .setLabel("Close Ticket")
                    .setStyle(ButtonStyle.Danger);

                const claimButton = new ButtonBuilder()
                    .setCustomId("claim_ticket")
                    .setLabel("Claim Ticket")
                    .setStyle(ButtonStyle.Success);

                const row = new ActionRowBuilder().addComponents(claimButton, closeButton);

                await channel.send({
                    content: `<@&${staffRoleId}>`,
                    embeds: [embed],
                    components: [row],
                    allowedMentions: { roles: [staffRoleId] }
                });

                await interaction.editReply({
                    content: `✅ Ticket created: ${channel}`
                });

            } catch (error) {
                console.error(error);
                await interaction.editReply({ content: "❌ Error creating ticket." });
            }
        }

        // ===== CLAIM TICKET =====
        if (interaction.customId === "claim_ticket") {

            if (!interaction.member.roles.cache.has(staffRoleId)) {
                return interaction.reply({
                    content: "❌ Only staff can claim tickets.",
                    ephemeral: true
                });
            }

            const message = interaction.message;
            const embed = EmbedBuilder.from(message.embeds[0]);

            if (embed.data.description.includes("Claimed by: ❌")) {

                embed.setDescription(
                    embed.data.description.replace(
                        "Claimed by: ❌ Not claimed",
                        `Claimed by: ${interaction.user}`
                    )
                );

                const disabledClaim = new ButtonBuilder()
                    .setCustomId("claim_ticket")
                    .setLabel("Claimed")
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true);

                const closeButton = new ButtonBuilder()
                    .setCustomId("close_ticket")
                    .setLabel("Close Ticket")
                    .setStyle(ButtonStyle.Danger);

                const row = new ActionRowBuilder().addComponents(disabledClaim, closeButton);

                await interaction.update({
                    embeds: [embed],
                    components: [row]
                });

            } else {
                await interaction.reply({
                    content: "❌ This ticket is already claimed.",
                    ephemeral: true
                });
            }
        }

        // ===== CLOSE =====
        if (interaction.customId === "close_ticket") {

            if (
                !interaction.member.roles.cache.has(staffRoleId) &&
                !openTickets.has(interaction.user.id)
            ) {
                return interaction.reply({
                    content: "❌ You do not have permission to close this ticket.",
                    ephemeral: true
                });
            }

            await interaction.reply("🔒 Closing ticket in 5 seconds...");

            setTimeout(() => {
                openTickets.forEach((value, key) => {
                    if (value === interaction.channel.id) {
                        openTickets.delete(key);
                    }
                });

                interaction.channel.delete().catch(console.error);
            }, 5000);
        }
    }
});


// ================= START =================

(async () => {
    try {
        await registerCommands();
        await client.login(token);
    } catch (error) {
        console.error("Startup error:", error);
    }
})();
