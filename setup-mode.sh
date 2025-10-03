#!/bin/bash

# SpinUp Setup Mode
# This script helps you enter setup wizard mode

echo "🔧 SpinUp Setup Mode"
echo ""
echo "This will temporarily rename your .env file and start the setup wizard."
echo "Your existing configuration will be backed up to .env.backup"
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 1
fi

# Backup existing .env if it exists
if [ -f .env ]; then
    echo "📦 Backing up existing .env to .env.backup"
    mv .env .env.backup
fi

echo "✅ Ready for setup!"
echo ""
echo "Now run: pnpm dev"
echo "Then visit: http://localhost:8080/api/setup"
echo ""
echo "To restore your old configuration: mv .env.backup .env"
