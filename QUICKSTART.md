# SpinUp Quick Start Guide

Get SpinUp running in **under 5 minutes**!

## One-Line Install (Coming Soon)

```bash
curl -fsSL https://get.spinup.dev | bash
```

## Manual Install (Current Method)

### Step 1: Install Prerequisites

**Ubuntu/Debian:**
```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm
npm install -g pnpm

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install PostgreSQL & Redis
docker run -d --name spinup-postgres \
  -e POSTGRES_USER=spinup \
  -e POSTGRES_PASSWORD=spinup \
  -e POSTGRES_DB=spinup \
  -p 5432:5432 \
  --restart unless-stopped \
  postgres:14

docker run -d --name spinup-redis \
  -p 6379:6379 \
  --restart unless-stopped \
  redis:7
```

### Step 2: Install SpinUp

```bash
# Clone repository
git clone https://github.com/yourusername/spinup.git
cd spinup

# Install dependencies
pnpm install

# Start SpinUp
pnpm dev
```

### Step 3: Complete Setup Wizard

Open your browser and go to:
```
http://localhost:8080/api/setup
```

Fill in the form:
- **Web URL**: `http://localhost:5173` (or your domain)
- **API URL**: `http://localhost:8080` (or your API domain)
- **Database URL**: `postgresql://spinup:spinup@localhost:5432/spinup`
- **Discord** (optional): Leave blank for now

Click **"Complete Setup"** and you're done! 🎉

### Step 4: Create Your First Server

1. After setup, you'll be redirected to the dashboard
2. Click **"Quick Dev Login"** (development mode only)
3. Click **"Create Server"**
4. Choose a game (e.g., Minecraft)
5. Name your server
6. Click **"Create"**
7. Click **"Start"** to launch your server!

## Production Deployment

For production, use our **1-click deployment** guides:

- 📘 [Deploy to DigitalOcean](./docs/deploy-digitalocean.md)
- 📗 [Deploy to AWS](./docs/deploy-aws.md)
- 📙 [Deploy to your own VPS](./INSTALL.md)

## Accessing from Another Computer

To access SpinUp from another device on your network:

1. Find your server's IP address:
```bash
hostname -I | awk '{print $1}'
```

2. Update the setup wizard URLs to use your IP:
   - Web URL: `http://YOUR_IP:5173`
   - API URL: `http://YOUR_IP:8080`

3. Access from any device: `http://YOUR_IP:5173`

## Using with a Domain Name

1. Point your domain to your server's IP
2. Install Caddy for automatic HTTPS:
```bash
sudo apt install -y caddy
```

3. Create `/etc/caddy/Caddyfile`:
```caddy
yourdomain.com {
    handle /api/* {
        reverse_proxy localhost:8080
    }
    handle {
        reverse_proxy localhost:5173
    }
}
```

4. Reload Caddy:
```bash
sudo systemctl reload caddy
```

5. Visit `https://yourdomain.com/api/setup` and complete setup with:
   - Web URL: `https://yourdomain.com`
   - API URL: `https://yourdomain.com` (same, using path-based routing)

## Troubleshooting

**"Connection refused" error?**
- Make sure Docker containers are running: `docker ps`
- Check PostgreSQL: `docker logs spinup-postgres`
- Check Redis: `docker logs spinup-redis`

**Can't access setup wizard?**
- Verify API is running: `curl http://localhost:8080/health`
- Check API logs for errors
- Make sure port 8080 isn't blocked by firewall

**Setup completed but can't login?**
- Restart the dev server: `pnpm dev`
- Clear browser cache and cookies
- Try "Quick Dev Login" button

## Next Steps

- ⚙️ [Configure Discord Bot](./docs/discord-setup.md)
- 🎮 [Add Custom Games](./docs/custom-games.md)
- 📊 [Monitor Resources](./docs/monitoring.md)
- 🔐 [Production Security](./docs/security.md)

## Support

Need help? We're here for you:
- 📖 [Full Documentation](./README.md)
- 💬 [Discord Community](https://discord.gg/your-invite)
- 🐛 [Report Issues](https://github.com/yourusername/spinup/issues)

---

**Happy gaming!** 🎮🚀
