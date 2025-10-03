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

### Installation (WordPress-style Setup Wizard!)

SpinUp features a **web-based setup wizard** - no manual configuration needed!

1. **Clone and install:**
```bash
git clone https://github.com/yourusername/spinup.git
cd spinup
pnpm install
```

2. **Start the server:**
```bash
pnpm dev
```

3. **Open the setup wizard:**
Navigate to `http://localhost:8080/api/setup` and complete the form. SpinUp will:
- ✅ Generate secure secrets automatically
- ✅ Create your `.env` file
- ✅ Initialize the database
- ✅ Set up your first admin user

4. **Start using SpinUp!**
Once setup completes, you'll be redirected to the dashboard.

📖 **[Full Installation Guide](./INSTALL.md)** - Detailed deployment instructions

### Prerequisites

- Node.js 18+
- pnpm 8+
- Docker running
- PostgreSQL 14+
- Redis

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

## Production Deployment

SpinUp is production-ready with full Docker support, SSL/TLS configuration, and comprehensive security features.

### Quick Production Setup

```bash
# 1. Clone repository
git clone https://github.com/yourusername/spinup.git
cd spinup

# 2. Configure environment
cp .env.production.example .env
# Edit .env with your production values

# 3. Generate secrets
echo "API_JWT_SECRET=$(openssl rand -hex 32)" >> .env
echo "SERVICE_TOKEN=$(openssl rand -hex 32)" >> .env
echo "POSTGRES_PASSWORD=$(openssl rand -hex 16)" >> .env

# 4. Deploy with Docker Compose
docker compose -f docker-compose.prod.yml up -d
```

### Features

✅ Production-ready Docker containers
✅ Automatic SSL/TLS with Let's Encrypt (via Nginx/Traefik)
✅ Health checks and monitoring endpoints
✅ Database migrations and backups
✅ Redis job queue with BullMQ
✅ Secure environment configuration
✅ Server-agnostic deployment

For detailed production deployment instructions, see [DEPLOY.md](./DEPLOY.md)

## Security

SpinUp includes comprehensive security features:
- JWT authentication with signed cookies
- CORS protection
- Path traversal prevention
- Command injection mitigation
- Rate limiting on sensitive endpoints
- Production error handling (no stack traces exposed)
- Input validation with Zod schemas
- Script security validation for custom servers

## License

MIT