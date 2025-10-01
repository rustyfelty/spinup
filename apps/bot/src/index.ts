import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'
import fetch from 'node-fetch'
import { GAMES } from '@spinup/shared'

const token = process.env.DISCORD_BOT_TOKEN!
const clientId = process.env.DISCORD_CLIENT_ID!
const API_URL = process.env.API_URL || 'http://localhost:8080'
const WEB_URL = process.env.WEB_URL || 'http://localhost:5173'
const SERVICE_TOKEN = process.env.SERVICE_TOKEN || 'supersecretservicetoken'
const DEV_GUILD = process.env.DISCORD_TEST_GUILD

// Build slash commands
const commands = [
  new SlashCommandBuilder()
    .setName('gameserver')
    .setDescription('Manage game servers')
    .addSubcommand(subcommand =>
      subcommand
        .setName('new')
        .setDescription('Create a new game server')
        .addStringOption(option =>
          option
            .setName('name')
            .setDescription('Server name (lowercase, hyphens allowed)')
            .setRequired(true)
            .setMinLength(3)
            .setMaxLength(30)
        )
        .addStringOption(option =>
          option
            .setName('game')
            .setDescription('Game to run')
            .setRequired(true)
            .addChoices(
              ...GAMES.map(game => ({
                name: game.name,
                value: game.key
              }))
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all your servers')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('start')
        .setDescription('Start a server')
        .addStringOption(option =>
          option
            .setName('id')
            .setDescription('Server ID')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('stop')
        .setDescription('Stop a server')
        .addStringOption(option =>
          option
            .setName('id')
            .setDescription('Server ID')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('restart')
        .setDescription('Restart a server')
        .addStringOption(option =>
          option
            .setName('id')
            .setDescription('Server ID')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Check server status')
        .addStringOption(option =>
          option
            .setName('id')
            .setDescription('Server ID')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('Delete a server')
        .addStringOption(option =>
          option
            .setName('id')
            .setDescription('Server ID')
            .setRequired(true)
        )
    )
].map(command => command.toJSON())

// Register commands
async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(token)

  try {
    console.log('Started refreshing application (/) commands.')

    if (DEV_GUILD) {
      // Register to specific guild for development
      await rest.put(
        Routes.applicationGuildCommands(clientId, DEV_GUILD),
        { body: commands }
      )
      console.log(`Successfully registered commands to guild ${DEV_GUILD}`)
    } else {
      // Register globally
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands }
      )
      console.log('Successfully registered global commands')
    }
  } catch (error) {
    console.error('Error registering commands:', error)
  }
}

// Auto-provision user and send magic link
async function provisionUserAndSendMagicLink(userId: string, guildId: string, username: string, avatarUrl?: string) {
  try {
    const response = await fetch(`${API_URL}/api/sso/discord/issue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_TOKEN}`
      },
      body: JSON.stringify({
        discordUserId: userId,
        discordGuildId: guildId,
        displayName: username,
        avatarUrl
      })
    })

    if (!response.ok) {
      throw new Error(`API responded with ${response.status}`)
    }

    const data = await response.json() as { magicUrl: string }
    return data.magicUrl
  } catch (error) {
    console.error('Failed to provision user:', error)
    return null
  }
}

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages
  ]
})

client.on('ready', () => {
  console.log(`✅ SpinUp bot logged in as ${client.user?.tag}`)
})

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return
  if (interaction.commandName !== 'gameserver') return

  // Ensure command is used in a guild
  if (!interaction.guild) {
    await interaction.reply({
      content: '❌ This command can only be used in a server.',
      ephemeral: true
    })
    return
  }

  // Auto-provision user and send magic link (best effort, don't block command)
  const magicLinkPromise = provisionUserAndSendMagicLink(
    interaction.user.id,
    interaction.guild.id,
    interaction.user.username,
    interaction.user.displayAvatarURL()
  )

  // Send magic link via DM if this is their first command
  magicLinkPromise.then(async magicUrl => {
    if (magicUrl) {
      try {
        const dmChannel = await interaction.user.createDM()

        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('🔐 Welcome to SpinUp!')
          .setDescription('Click the link below to access your SpinUp dashboard:')
          .addFields(
            { name: '🔗 Magic Link', value: `[Click here to sign in](${magicUrl})` },
            { name: '⏱️ Expires In', value: '5 minutes', inline: true },
            { name: '🔒 Security', value: 'Single use only', inline: true }
          )
          .setFooter({ text: 'This link will expire in 5 minutes' })
          .setTimestamp()

        await dmChannel.send({ embeds: [embed] })
      } catch (error) {
        console.error('Failed to send DM:', error)
        // User might have DMs disabled, continue anyway
      }
    }
  })

  const subcommand = interaction.options.getSubcommand()

  // Defer reply for all commands as they might take time
  await interaction.deferReply({ ephemeral: true })

  try {
    switch (subcommand) {
      case 'new': {
        const name = interaction.options.getString('name', true)
        const gameKey = interaction.options.getString('game', true)

        // Validate name format
        if (!/^[a-z0-9-]+$/.test(name)) {
          await interaction.editReply('❌ Server name must contain only lowercase letters, numbers, and hyphens.')
          return
        }

        // Create server via API
        const response = await fetch(`${API_URL}/api/servers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orgId: interaction.guild.id,
            name,
            gameKey
          })
        })

        if (!response.ok) {
          await interaction.editReply('❌ Failed to create server. Please try again.')
          return
        }

        const { id } = await response.json() as { id: string }

        const embed = new EmbedBuilder()
          .setColor(0x00D26A)
          .setTitle('✅ Server Created!')
          .setDescription(`Your **${name}** server is being set up.`)
          .addFields(
            { name: 'Game', value: GAMES.find(g => g.key === gameKey)?.name || gameKey, inline: true },
            { name: 'Server ID', value: `\`${id}\``, inline: true },
            { name: 'Status', value: '🔄 Creating...', inline: true }
          )
          .setFooter({ text: 'Use /gameserver status to check progress' })

        const row = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setLabel('Open Dashboard')
              .setStyle(ButtonStyle.Link)
              .setURL(`${WEB_URL}/servers/${id}`)
              .setEmoji('🎮')
          )

        await interaction.editReply({ embeds: [embed], components: [row] })
        break
      }

      case 'list': {
        // Fetch servers from API
        const response = await fetch(`${API_URL}/api/servers?orgId=${interaction.guild.id}`)

        if (!response.ok) {
          await interaction.editReply('❌ Failed to fetch servers.')
          return
        }

        const servers = await response.json() as any[]

        if (servers.length === 0) {
          const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('📋 Your Servers')
            .setDescription('You don\'t have any servers yet.')
            .addFields(
              { name: 'Get Started', value: 'Use `/gameserver new` to create your first server!' }
            )

          await interaction.editReply({ embeds: [embed] })
        } else {
          const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('📋 Your Servers')
            .setDescription(`You have ${servers.length} server(s)`)

          servers.slice(0, 10).forEach(server => {
            const statusEmoji = {
              RUNNING: '✅',
              STOPPED: '⏹️',
              CREATING: '🔄',
              ERROR: '❌',
              DELETING: '🗑️'
            }[server.status] || '❓'

            embed.addFields({
              name: `${statusEmoji} ${server.name}`,
              value: `ID: \`${server.id}\`\nGame: ${server.gameKey}\nStatus: ${server.status}`,
              inline: true
            })
          })

          const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
              new ButtonBuilder()
                .setLabel('Open Dashboard')
                .setStyle(ButtonStyle.Link)
                .setURL(WEB_URL)
                .setEmoji('🎮')
            )

          await interaction.editReply({ embeds: [embed], components: [row] })
        }
        break
      }

      case 'start':
      case 'stop':
      case 'restart': {
        const id = interaction.options.getString('id', true)

        const response = await fetch(`${API_URL}/api/servers/${id}/${subcommand}`, {
          method: 'POST'
        })

        if (!response.ok) {
          if (response.status === 404) {
            await interaction.editReply('❌ Server not found.')
          } else {
            await interaction.editReply(`❌ Failed to ${subcommand} server.`)
          }
          return
        }

        const actionEmoji = {
          start: '▶️',
          stop: '⏹️',
          restart: '🔄'
        }[subcommand]

        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle(`${actionEmoji} Server ${subcommand === 'stop' ? 'Stopped' : subcommand === 'start' ? 'Started' : 'Restarted'}`)
          .setDescription(`Server \`${id}\` is being ${subcommand === 'stop' ? 'stopped' : subcommand === 'start' ? 'started' : 'restarted'}.`)
          .setFooter({ text: 'This may take a few moments' })

        await interaction.editReply({ embeds: [embed] })
        break
      }

      case 'status': {
        const id = interaction.options.getString('id', true)

        const response = await fetch(`${API_URL}/api/servers/${id}`)

        if (!response.ok) {
          if (response.status === 404) {
            await interaction.editReply('❌ Server not found.')
          } else {
            await interaction.editReply('❌ Failed to fetch server status.')
          }
          return
        }

        const server = await response.json() as any

        const statusColor = {
          RUNNING: 0x00D26A,
          STOPPED: 0x6B7280,
          CREATING: 0x3B82F6,
          ERROR: 0xEF4444,
          DELETING: 0xF59E0B
        }[server.status] || 0x5865F2

        const embed = new EmbedBuilder()
          .setColor(statusColor)
          .setTitle(`📊 Server Status: ${server.name}`)
          .addFields(
            { name: 'Status', value: server.status, inline: true },
            { name: 'Game', value: server.gameKey, inline: true },
            { name: 'Server ID', value: `\`${server.id}\``, inline: true }
          )

        if (server.ports && server.ports.length > 0) {
          const portList = server.ports.map((p: any) => `${p.host}:${p.container}/${p.proto}`).join(', ')
          embed.addFields({ name: 'Ports', value: portList })
        }

        const row = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setLabel('View in Dashboard')
              .setStyle(ButtonStyle.Link)
              .setURL(`${WEB_URL}/servers/${id}`)
              .setEmoji('🎮')
          )

        await interaction.editReply({ embeds: [embed], components: [row] })
        break
      }

      case 'delete': {
        const id = interaction.options.getString('id', true)

        const response = await fetch(`${API_URL}/api/servers/${id}`, {
          method: 'DELETE'
        })

        if (!response.ok) {
          if (response.status === 404) {
            await interaction.editReply('❌ Server not found.')
          } else {
            await interaction.editReply('❌ Failed to delete server.')
          }
          return
        }

        const embed = new EmbedBuilder()
          .setColor(0xEF4444)
          .setTitle('🗑️ Server Deleted')
          .setDescription(`Server \`${id}\` has been queued for deletion.`)
          .setFooter({ text: 'This action cannot be undone' })

        await interaction.editReply({ embeds: [embed] })
        break
      }

      default:
        await interaction.editReply('❌ Unknown command.')
    }
  } catch (error) {
    console.error('Command error:', error)
    await interaction.editReply('❌ An error occurred while processing your command.')
  }
})

// Start the bot
async function start() {
  try {
    await registerCommands()
    await client.login(token)
  } catch (error) {
    console.error('Failed to start bot:', error)
    process.exit(1)
  }
}

start()