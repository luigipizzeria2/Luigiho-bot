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

const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    getVoiceConnection
} = require('@discordjs/voice');

const play = require('play-dl');
const { MongoClient } = require('mongodb');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
const staffRoleId = process.env.STAFF_ROLE_ID;
const mongoURI = process.env.MONGO_URI;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
    ]
});

let database;
const musicQueues = new Map(); // guildId -> queue

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
            .setDescription('Close your open ticket'),

        new SlashCommandBuilder()
            .setName('play')
            .setDescription('Play a YouTube URL')
            .addStringOption(option =>
                option.setName('url')
                    .setDescription('YouTube URL')
                    .setRequired(true)
            ),

        new SlashCommandBuilder()
            .setName('skip')
            .setDescription('Skip current song'),

        new SlashCommandBuilder()
            .setName('stop')
            .setDescription('Stop music and clear queue')

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

// ================= MUSIC LOGIC =================
async function playSong(guild, song) {
    const queue = musicQueues.get(guild.id);
    if (!song) {
        queue.connection.destroy();
        musicQueues.delete(guild.id);
        return;
    }

    const stream = await play.stream(song.url);
    const resource = createAudioResource(stream.stream, {
        inputType: stream.type
    });

    queue.player.play(resource);
}

client.on(Events.InteractionCreate, async interaction => {
    try {

        if (!interaction.isChatInputCommand()) return;

        // ================= MUSIC COMMANDS =================

        if (interaction.commandName === 'play') {

            const url = interaction.options.getString('url');
            const voiceChannel = interaction.member.voice.channel;

            if (!voiceChannel) {
                return interaction.reply({
                    content: "❌ You must be in a voice channel.",
                    ephemeral: true
                });
            }

            await interaction.deferReply();

            const songInfo = await play.video_info(url).catch(() => null);

            if (!songInfo) {
                return interaction.editReply("❌ Invalid YouTube URL.");
            }

            const song = {
                title: songInfo.video_details.title,
                url: url
            };

            let queue = musicQueues.get(interaction.guild.id);

            if (!queue) {
                const player = createAudioPlayer();
                const connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: interaction.guild.id,
                    adapterCreator: interaction.guild.voiceAdapterCreator
                });

                queue = {
                    songs: [],
                    connection: connection,
                    player: player
                };

                musicQueues.set(interaction.guild.id, queue);

                connection.subscribe(player);

                player.on(AudioPlayerStatus.Idle, () => {
                    queue.songs.shift();
                    playSong(interaction.guild, queue.songs[0]);
                });

                player.on('error', error => {
                    console.error(error);
                    queue.songs.shift();
                    playSong(interaction.guild, queue.songs[0]);
                });
            }

            queue.songs.push(song);

            if (queue.songs.length === 1) {
                playSong(interaction.guild, queue.songs[0]);
            }

            return interaction.editReply(`🎵 Added to queue: **${song.title}**`);
        }

        if (interaction.commandName === 'skip') {

            const queue = musicQueues.get(interaction.guild.id);
            if (!queue) return interaction.reply("❌ Nothing playing.");

            queue.player.stop();
            return interaction.reply("⏭ Skipped.");
        }

        if (interaction.commandName === 'stop') {

            const queue = musicQueues.get(interaction.guild.id);
            if (!queue) return interaction.reply("❌ Nothing playing.");

            queue.songs = [];
            queue.player.stop();
            queue.connection.destroy();
            musicQueues.delete(interaction.guild.id);

            return interaction.reply("🛑 Stopped and cleared queue.");
        }

        // ================= TICKET COMMANDS =================
        if (interaction.commandName === 'ticketpanel') {
            return interaction.reply("🎟 Ticket system still active.");
        }

        if (interaction.commandName === 'close') {
            return interaction.reply("Ticket close logic here.");
        }

    } catch (err) {
        console.error(err);
        if (!interaction.replied && !interaction.deferred) {
            interaction.reply({ content: "❌ Error occurred.", ephemeral: true }).catch(() => {});
        }
    }
});

// ================= START =================
(async () => {
    await connectDB();
    await registerCommands();
    await client.login(token);
})();
