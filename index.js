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
const guildId = process.env.GUILD_ID; // IMPORTANT

if (!token || !clientId || !mongoUri || !guildId) {
    console.error("❌ Missing values in .env file.");
    process.exit(1);
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

const app = express();
let database;
const activePolls = new Map();

/* ================= DATABASE ================= */

async function connectDB() {
    const mongo = new MongoClient(mongoUri);
    await mongo.connect();
    database = mongo.db("luigihoBot");
    console.log("✅ Connected to MongoDB");
}

async function getConfig(guildId) {
    return await database.collection("configs").findOne({ guildId });
}

async function setConfig(guildId, data) {
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

/* ================= TIME ================= */

function parseTime(input) {
    const match = input.match(/^(\d+)([smhd])$/);
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2];

    const multipliers = { s:1000, m:60000, h:3600000, d:86400000 };
    return value * multipliers[unit];
}

/* ================= REGISTER COMMANDS (GUILD) ================= */

async function registerCommands() {

    const commands = [

        new SlashCommandBuilder()
            .setName("setup")
            .setDescription("Setup staff role")
            .addRoleOption(opt =>
                opt.setName("staff")
                    .setDescription("Staff role")
                    .setRequired(true)
            ),

        new SlashCommandBuilder()
            .setName("ticketpanel")
            .setDescription("Create ticket panel")
            .addStringOption(opt =>
                opt.setName("types")
                    .setDescription("Support; Ideas; Help")
                    .setRequired(true)
            ),

        new SlashCommandBuilder()
            .setName("close")
            .setDescription("Close this ticket"),

        new SlashCommandBuilder()
            .setName("suggest")
            .setDescription("Create suggestion poll")
            .addStringOption(opt =>
                opt.setName("text")
                    .setDescription("Suggestion text")
                    .setRequired(true)
            )
            .addStringOption(opt =>
                opt.setName("time")
                    .setDescription("10m, 1h, 1d")
                    .setRequired(true)
            )

    ].map(c => c.toJSON());

    const rest = new REST({ version: "10" }).setToken(token);

    await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands }
    );

    console.log("✅ Guild commands registered (no duplicates)");
}

/* ================= BOT ================= */

client.once("clientReady", () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on("interactionCreate", async interaction => {

    try {

        if (interaction.isChatInputCommand()) {

            const config = await getConfig(interaction.guild.id) || {};

            /* SETUP */
            if (interaction.commandName === "setup") {

                const role = interaction.options.getRole("staff");

                await setConfig(interaction.guild.id, {
                    staffRoleId: role.id,
                    ticketsEnabled: true,
                    suggestionsEnabled: true
                });

                return interaction.reply({
                    content: `✅ Staff role set to ${role}`,
                    ephemeral: true
                });
            }

            /* TICKET PANEL */
            if (interaction.commandName === "ticketpanel") {

                if (!config.staffRoleId)
                    return interaction.reply({ content:"❌ Run /setup first.", ephemeral:true });

                const types = interaction.options.getString("types")
                    .split(";")
                    .map(t => t.trim())
                    .filter(Boolean);

                await setConfig(interaction.guild.id, { ticketTypes: types });

                const embed = new EmbedBuilder()
                    .setTitle("🎟 Open a Ticket")
                    .setDescription("Choose a ticket type.")
                    .setColor(0x5865F2);

                const menu = new StringSelectMenuBuilder()
                    .setCustomId("ticket_type")
                    .setPlaceholder("Select type")
                    .addOptions(types.map((t,i)=>({ label:t, value:i.toString() })));

                return interaction.reply({
                    embeds:[embed],
                    components:[new ActionRowBuilder().addComponents(menu)]
                });
            }

            /* CLOSE */
            if (interaction.commandName === "close") {

                if (!interaction.channel.name.startsWith("ticket-"))
                    return interaction.reply({ content:"❌ Not a ticket.", ephemeral:true });

                await interaction.reply("🔒 Closing...");
                setTimeout(()=>interaction.channel.delete().catch(()=>{}),2000);
                return;
            }

            /* SUGGEST */
            if (interaction.commandName === "suggest") {

                const duration = parseTime(interaction.options.getString("time"));
                if (!duration)
                    return interaction.reply({ content:"❌ Invalid time.", ephemeral:true });

                const text = interaction.options.getString("text");

                const embed = new EmbedBuilder()
                    .setTitle("📢 Suggestion")
                    .setDescription(text)
                    .addFields(
                        { name:"👍 Yes", value:"0", inline:true },
                        { name:"👎 No", value:"0", inline:true }
                    );

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("yes").setLabel("👍").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId("no").setLabel("👎").setStyle(ButtonStyle.Danger)
                );

                const msg = await interaction.reply({
                    embeds:[embed],
                    components:[row],
                    fetchReply:true
                });

                activePolls.set(msg.id,{ yes:new Set(), no:new Set() });

                setTimeout(async ()=>{
                    const poll = activePolls.get(msg.id);
                    if(!poll) return;

                    const voters = [...poll.yes, ...poll.no];

                    await msg.edit({
                        embeds:[
                            new EmbedBuilder()
                                .setTitle("📊 Poll Ended")
                                .setDescription(text)
                                .addFields(
                                    { name:"👍 Yes", value:String(poll.yes.size), inline:true },
                                    { name:"👎 No", value:String(poll.no.size), inline:true }
                                )
                        ],
                        components:[]
                    });

                    if(voters.length)
                        await msg.channel.send(voters.map(id=>`<@${id}>`).join(" "));

                    activePolls.delete(msg.id);

                }, duration);
            }
        }

        /* SELECT MENU */
        if (interaction.isStringSelectMenu()) {

            if (interaction.customId !== "ticket_type") return;

            await interaction.deferReply({ ephemeral:true });

            const config = await getConfig(interaction.guild.id);
            if(!config || !config.staffRoleId)
                return interaction.editReply("❌ Setup not complete.");

            const index = parseInt(interaction.values[0]);
            const typeName = config.ticketTypes[index];

            const count = await incrementTicketCount(interaction.guild.id);

            const channel = await interaction.guild.channels.create({
                name:`ticket-${count}`,
                type:ChannelType.GuildText,
                permissionOverwrites:[
                    { id:interaction.guild.roles.everyone, deny:[PermissionFlagsBits.ViewChannel] },
                    { id:interaction.user.id, allow:[PermissionFlagsBits.ViewChannel] },
                    { id:config.staffRoleId, allow:[PermissionFlagsBits.ViewChannel] }
                ]
            });

            const claimBtn = new ButtonBuilder()
                .setCustomId("claim")
                .setLabel("Claim Ticket")
                .setStyle(ButtonStyle.Primary);

            await channel.send({
                content:`Ticket Type: **${typeName}**\n<@&${config.staffRoleId}>`,
                components:[new ActionRowBuilder().addComponents(claimBtn)]
            });

            return interaction.editReply(`✅ Created ${channel}`);
        }

        /* BUTTONS */
        if (interaction.isButton()) {

            if (interaction.customId === "claim") {
                await interaction.reply({
                    content:`🎟 Claimed by ${interaction.user}`,
                    allowedMentions:{ parse:[] }
                });
                await interaction.message.edit({ components:[] });
                return;
            }

            const poll = activePolls.get(interaction.message.id);
            if(!poll)
                return interaction.reply({ content:"Poll expired.", ephemeral:true });

            if(interaction.customId==="yes"){
                poll.no.delete(interaction.user.id);
                poll.yes.add(interaction.user.id);
            }
            if(interaction.customId==="no"){
                poll.yes.delete(interaction.user.id);
                poll.no.add(interaction.user.id);
            }

            const embed = EmbedBuilder.from(interaction.message.embeds[0])
                .setFields(
                    { name:"👍 Yes", value:String(poll.yes.size), inline:true },
                    { name:"👎 No", value:String(poll.no.size), inline:true }
                );

            return interaction.update({ embeds:[embed] });
        }

    } catch(err){
        console.error(err);
        if(!interaction.replied)
            interaction.reply({ content:"❌ Something went wrong.", ephemeral:true }).catch(()=>{});
    }
});

/* ================= WEBSITE ================= */

app.get("/", (req,res)=>{
    res.send("<h1>Luigiho Bot Running 🚀</h1>");
});

/* ================= START ================= */

(async()=>{
    await connectDB();
    await registerCommands();
    await client.login(token);

    app.listen(3000,"0.0.0.0",()=>{
        console.log("🌐 Web server running");
    });
})();