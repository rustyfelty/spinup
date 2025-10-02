#!/bin/bash

# SpinUp Clean Restart Script
# This script ensures all old dev processes are killed and dev servers start on correct ports

set -e

echo "🧹 Cleaning up old dev processes..."

# Kill all dev-related processes
pkill -9 -f "concurrently.*dev" 2>/dev/null || true
pkill -9 -f "tsx watch" 2>/dev/null || true
pkill -9 -f "vite" 2>/dev/null || true
pkill -9 -f "pnpm dev" 2>/dev/null || true

echo "⏳ Waiting for ports to be released..."
sleep 2

# Check if ports are still in use
echo "🔍 Checking ports..."
if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Port 8080 still in use. Force killing..."
    kill -9 $(lsof -t -i:8080) 2>/dev/null || true
    sleep 1
fi

if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Port 5173 still in use. Force killing..."
    kill -9 $(lsof -t -i:5173) 2>/dev/null || true
    sleep 1
fi

echo "✅ Ports cleared!"

# Verify NODE_ENV
if grep -q "^NODE_ENV=development" .env; then
    echo "✅ NODE_ENV is set to development"
else
    echo "⚠️  WARNING: NODE_ENV is not set to development in .env"
    echo "Current value: $(grep ^NODE_ENV .env || echo 'NOT SET')"
fi

echo ""
echo "🚀 Starting dev servers..."
echo "   API will run on port 8080"
echo "   Web will run on port 5173"
echo ""

# Start dev servers
pnpm dev

