# SpinUp Deployment Guide

This guide covers deploying SpinUp to a production server.

## Prerequisites

- Linux server (Ubuntu 22.04+ or Debian 11+ recommended)
- Docker and Docker Compose installed
- Domain name with DNS configured
- Minimum 2GB RAM, 2 CPU cores
- At least 20GB disk space

## Quick Start

### 1. Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Add your user to docker group (logout/login required)
sudo usermod -aG docker $USER
```

### 2. Clone Repository

```bash
git clone https://github.com/yourusername/spinup.git
cd spinup
```

### 3. Configure Environment

```bash
# Copy production environment template
cp .env.production.example .env

# Generate secure secrets
echo "API_JWT_SECRET=$(openssl rand -hex 32)" >> .env
echo "SERVICE_TOKEN=$(openssl rand -hex 32)" >> .env
echo "POSTGRES_PASSWORD=$(openssl rand -hex 16)" >> .env

# Edit .env and update:
# - WEB_ORIGIN (your domain: https://yourdomain.com)
# - VITE_API_URL (your API URL: https://api.yourdomain.com)
# - API_URL (same as VITE_API_URL)
# - DISCORD_* variables (if using Discord bot)
nano .env
```

### 4. Build Docker Images

```bash
# Build all production images
docker compose -f docker-compose.prod.yml build
```

### 5. Initialize Database

```bash
# Start only postgres and redis
docker compose -f docker-compose.prod.yml up -d postgres redis

# Wait for postgres to be ready
sleep 10

# Run database migrations
docker compose -f docker-compose.prod.yml run --rm api npx prisma migrate deploy

# (Optional) Seed database with initial data
docker compose -f docker-compose.prod.yml run --rm api npx prisma db seed
```

### 6. Start Services

```bash
# Start all services (without Discord bot)
docker compose -f docker-compose.prod.yml up -d

# Or with Discord bot
docker compose -f docker-compose.prod.yml --profile discord up -d

# Check logs
docker compose -f docker-compose.prod.yml logs -f
```

### 7. Verify Deployment

```bash
# Check health endpoint
curl http://localhost:8080/api/system/health

# Check all containers are running
docker compose -f docker-compose.prod.yml ps
```

## SSL/TLS Configuration

### Option 1: Nginx Reverse Proxy with Let's Encrypt

```bash
# Install nginx and certbot
sudo apt install nginx certbot python3-certbot-nginx -y

# Create nginx config
sudo nano /etc/nginx/sites-available/spinup
```

```nginx
# API Server
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Web App
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:80;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site and restart nginx
sudo ln -s /etc/nginx/sites-available/spinup /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Get SSL certificates
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com -d api.yourdomain.com
```

### Option 2: Traefik (Alternative)

See [Traefik Documentation](https://doc.traefik.io/traefik/) for automatic SSL with Let's Encrypt.

## Environment Variables Reference

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Yes | - |
| `API_JWT_SECRET` | JWT signing secret (32+ chars) | Yes | - |
| `SERVICE_TOKEN` | Internal service token (32+ chars) | Yes | - |
| `API_PORT` | API server port | No | 8080 |
| `API_URL` | Public API URL | Yes | - |
| `WEB_ORIGIN` | Web app URL (for CORS) | Yes | - |
| `VITE_API_URL` | API endpoint for web app | Yes | - |
| `DATA_DIR` | Game server data directory | No | /srv/spinup |
| `DISCORD_TOKEN` | Discord bot token | No* | - |
| `DISCORD_CLIENT_ID` | Discord OAuth client ID | No* | - |
| `DISCORD_CLIENT_SECRET` | Discord OAuth secret | No* | - |
| `REDIS_HOST` | Redis hostname | No | redis |
| `REDIS_PORT` | Redis port | No | 6379 |
| `NODE_ENV` | Environment mode | No | production |

\* Required if using Discord bot

## Docker Commands

```bash
# View logs
docker compose -f docker-compose.prod.yml logs -f [service_name]

# Restart a service
docker compose -f docker-compose.prod.yml restart [service_name]

# Stop all services
docker compose -f docker-compose.prod.yml down

# Stop and remove volumes (WARNING: deletes data)
docker compose -f docker-compose.prod.yml down -v

# Update to latest version
git pull
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

## Database Management

```bash
# Backup database
docker exec spinup-postgres pg_dump -U spinup spinup > backup-$(date +%Y%m%d).sql

# Restore database
docker exec -i spinup-postgres psql -U spinup spinup < backup-20240101.sql

# Access database shell
docker exec -it spinup-postgres psql -U spinup spinup
```

## Monitoring

### Health Checks

- **API Health**: `http://your-api-url/api/system/health`
- **System Resources**: `http://your-api-url/api/system/resources`

### Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f api

# Last 100 lines
docker compose -f docker-compose.prod.yml logs --tail=100
```

## Troubleshooting

### API won't start

```bash
# Check environment variables
docker compose -f docker-compose.prod.yml config

# Verify secrets are set correctly
grep -E "API_JWT_SECRET|SERVICE_TOKEN" .env

# Check database connection
docker compose -f docker-compose.prod.yml exec api npx prisma db pull
```

### Can't create game servers

```bash
# Verify Docker socket is mounted
docker compose -f docker-compose.prod.yml exec api ls -la /var/run/docker.sock

# Check permissions
docker compose -f docker-compose.prod.yml exec api docker ps
```

### High memory usage

```bash
# Check container stats
docker stats

# Limit container memory in docker-compose.prod.yml
# Add to service definition:
#   deploy:
#     resources:
#       limits:
#         memory: 1G
```

### Database migration issues

```bash
# Reset database (WARNING: loses data)
docker compose -f docker-compose.prod.yml down -v
docker compose -f docker-compose.prod.yml up -d postgres redis
sleep 10
docker compose -f docker-compose.prod.yml run --rm api npx prisma migrate deploy
```

## Security Checklist

- [ ] Changed all default secrets in `.env`
- [ ] API_JWT_SECRET is 32+ characters
- [ ] SERVICE_TOKEN is 32+ characters
- [ ] PostgreSQL password is strong
- [ ] SSL/TLS certificates configured
- [ ] Firewall configured (only allow 80, 443, 22)
- [ ] Docker socket permissions verified
- [ ] Regular backups scheduled
- [ ] Environment variables not committed to git
- [ ] `NODE_ENV=production` set

## Firewall Configuration

```bash
# Allow SSH, HTTP, HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow game server ports (adjust as needed)
sudo ufw allow 25565:25575/tcp  # Minecraft range
sudo ufw allow 27015:27020/udp  # Source engine games

# Enable firewall
sudo ufw enable
```

## Maintenance

### Regular Updates

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Docker images
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

# Prune old images/containers
docker system prune -a
```

### Backup Strategy

1. **Database**: Daily automated backups
2. **Game server data**: `/srv/spinup` volume
3. **Environment config**: `.env` file (secure storage)

```bash
# Backup script example (add to cron)
#!/bin/bash
BACKUP_DIR="/backups/spinup"
DATE=$(date +%Y%m%d-%H%M%S)

# Backup database
docker exec spinup-postgres pg_dump -U spinup spinup | gzip > "$BACKUP_DIR/db-$DATE.sql.gz"

# Backup game server data
tar czf "$BACKUP_DIR/data-$DATE.tar.gz" -C /srv/spinup .

# Keep only last 7 days
find "$BACKUP_DIR" -name "*.gz" -mtime +7 -delete
```

## Support

For issues and questions:
- GitHub Issues: https://github.com/yourusername/spinup/issues
- Documentation: https://github.com/yourusername/spinup/wiki
