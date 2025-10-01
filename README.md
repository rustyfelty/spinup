# SpinUp - Game Server Management Platform

SpinUp lets users create, start, stop, and delete Dockerized game servers from a sleek web app with Discord bot integration.

## Features

- 🎮 Support for 12 popular games (Minecraft, Valheim, Factorio, and more)
- 🌐 Modern web dashboard built with React + TypeScript
- 🚀 Quick Dev Login - start using immediately without any setup
- 🤖 Optional Discord bot with slash commands
- 🔐 Discord SSO with magic link authentication (optional)
- ⚙️ Minecraft server configuration editor
- 🐳 Docker-based game server orchestration

## Tech Stack

- **Frontend**: Vite, React, TypeScript, TailwindCSS
- **Backend**: Node.js, Fastify, Prisma, PostgreSQL
- **Bot**: Discord.js
- **Infrastructure**: Docker, Redis (job queue), BullMQ

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker & Docker Compose
- Discord Application (optional - only for Discord integration)

### Quick Setup (No Discord Required!)

1. Clone and run the setup script:
```bash
git clone https://github.com/yourusername/spinup.git
cd spinup
./setup.sh
```

2. Start the development servers:
```bash
pnpm dev
```

3. Open http://localhost:5173 and click **"Quick Dev Login"** to start immediately!

The services are available at:
- Web Dashboard: http://localhost:5173
- API: http://localhost:8080

### Using SpinUp

With the Quick Dev Login, you can immediately:
- Create game servers for any of the 12 supported games
- Start, stop, and manage servers from the web interface
- Configure Minecraft servers with the built-in editor
- Monitor server status and resource usage

## Optional: Discord Bot Setup

Want to control servers from Discord? Follow these steps:

1. Create a Discord Application at https://discord.com/developers/applications
2. Create a Bot and copy the token
3. Update your `.env` file - uncomment and fill in:
   - `DISCORD_BOT_TOKEN=your-bot-token`
   - `DISCORD_CLIENT_ID=your-client-id`
   - `VITE_DISCORD_CLIENT_ID=your-client-id`
4. Restart with Discord enabled:
   ```bash
   pnpm dev:with-bot
   ```
5. Go to http://localhost:5173/integrations/discord to add the bot to your server

## Available Games

- Minecraft (Java & Bedrock)
- Valheim
- Factorio
- Palworld
- Rust
- Project Zomboid
- ARK: Survival Evolved
- Terraria
- Counter-Strike 2
- Satisfactory
- 7 Days to Die

## Project Structure

```
spinup/
├── apps/
│   ├── web/        # React frontend
│   ├── api/        # Fastify backend
│   └── bot/        # Discord bot
├── packages/
│   └── shared/     # Shared types and utilities
└── infra/          # Docker compose and configs
```

## Development

```bash
# Run specific services
pnpm dev:web    # Frontend only
pnpm dev:api    # Backend only
pnpm dev:bot    # Discord bot only

# Database management
pnpm db:studio  # Open Prisma Studio
pnpm db:migrate # Run migrations

# Build for production
pnpm build
```

## License

MIT