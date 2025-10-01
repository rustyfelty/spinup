#!/bin/bash

echo "🚀 SpinUp Setup Script"
echo "====================="

# Check for required tools
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20+"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed. Installing pnpm..."
    npm install -g pnpm
fi

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker"
    exit 1
fi

echo "✅ Prerequisites checked"

# Copy environment file
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "✅ Environment file created (Discord is optional)"
else
    echo "✅ .env file already exists"
fi

# Start infrastructure
echo "🐳 Starting PostgreSQL and Redis..."
docker compose -f infra/docker-compose.yml up -d

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 5

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Build shared package
echo "🔨 Building shared package..."
pnpm --filter @spinup/shared build

# Push database schema
echo "🗄️ Setting up database schema..."
pnpm db:push

echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀 Quick Start:"
echo "  1. Run: pnpm dev"
echo "  2. Open: http://localhost:5173"
echo "  3. Click 'Quick Dev Login' to start using SpinUp immediately!"
echo ""
echo "🤖 Optional Discord Integration:"
echo "  When you're ready to add Discord:"
echo "  1. Create app at https://discord.com/developers/applications"
echo "  2. Add credentials to .env file (currently commented out)"
echo "  3. Run: pnpm dev:with-bot"
echo ""
echo "🎮 Individual services:"
echo "  - pnpm dev:api  (API server only)"
echo "  - pnpm dev:web  (Web dashboard only)"
echo "  - pnpm dev:bot  (Discord bot only)"
echo ""
echo "📚 Documentation: https://github.com/yourusername/spinup"