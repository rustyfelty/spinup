# SpinUp Generic Game Server Container

A flexible Docker container that can run any game server by accepting custom startup scripts.

## Features

- **Ubuntu 22.04 LTS** base
- **SteamCMD** pre-installed for Steam game servers
- **Wine** support for Windows-only servers
- **32-bit libraries** for legacy games
- **Non-root execution** (UID 1000) for security
- **Common tools**: curl, wget, git, jq, netcat, etc.

## Architecture

```
┌─────────────────────────────────────────┐
│     Generic Container                   │
│                                         │
│  ┌────────────────────────────────┐   │
│  │   entrypoint.sh                 │   │
│  │   (validates & executes script) │   │
│  └──────────┬─────────────────────┘   │
│             │                           │
│             ▼                           │
│  ┌────────────────────────────────┐   │
│  │   /startup/server_init.sh       │   │
│  │   (custom user script)          │   │
│  │   - Downloads game server       │   │
│  │   - Configures settings         │   │
│  │   - Starts server process       │   │
│  └────────────────────────────────┘   │
│                                         │
│  /data (persistent volume)              │
└─────────────────────────────────────────┘
```

## Usage

### 1. Build the Image

```bash
cd infra/generic-server
docker build -t spinup/generic-server:latest .
```

### 2. Create a Startup Script

Example script for a simple game server:

```bash
#!/bin/bash
set -euo pipefail

echo "Installing MyGame Server..."

# Download server files
cd /data
wget https://example.com/myserver.tar.gz
tar -xzf myserver.tar.gz
rm myserver.tar.gz

# Configure server
cat > /data/server.cfg <<EOF
port=${SERVER_PORT:-27015}
maxplayers=${MAX_PLAYERS:-16}
servername="${SERVER_NAME:-MyServer}"
EOF

# Start server (must run in foreground)
cd /data/myserver
exec ./myserver_binary -config /data/server.cfg
```

### 3. Run the Container

```bash
docker run -d \
  --name my-game-server \
  -v $(pwd)/server_init.sh:/startup/server_init.sh:ro \
  -v my-server-data:/data \
  -p 27015:27015/udp \
  -e SERVER_PORT=27015 \
  -e MAX_PLAYERS=16 \
  -e SERVER_NAME="My Awesome Server" \
  --memory=2g \
  --cpus=2 \
  spinup/generic-server:latest
```

## Security Considerations

### Container Security

- Runs as non-root user (gameserver, UID 1000)
- Apply AppArmor/SELinux profiles in production
- Use `--security-opt=no-new-privileges`
- Limit resources with `--memory` and `--cpus`
- No privileged mode or host network access

### Script Validation

Before running user-provided scripts:

1. **Size limit**: Maximum 64KB
2. **Hash verification**: SHA-256 checksum
3. **Content scanning**: Block dangerous patterns:
   - `rm -rf /`
   - `curl | sh`
   - `eval`
   - Suspicious network calls
4. **User confirmation**: Show script preview

### Example Security Wrapper

```bash
# Check script size
if [ $(stat -f%z script.sh) -gt 65536 ]; then
    echo "Script too large (max 64KB)"
    exit 1
fi

# Verify hash
expected_hash="abc123..."
actual_hash=$(sha256sum script.sh | awk '{print $1}')
if [ "$actual_hash" != "$expected_hash" ]; then
    echo "Script hash mismatch!"
    exit 1
fi

# Scan for dangerous patterns
if grep -E '(rm -rf /|curl.*\| *sh|eval )' script.sh; then
    echo "Dangerous pattern detected!"
    exit 1
fi
```

## Example Scripts

### SteamCMD Game (CS:GO)

```bash
#!/bin/bash
set -euo pipefail

APP_ID=740  # CS:GO dedicated server
INSTALL_DIR="/data/csgo"

echo "Installing CS:GO Dedicated Server..."

# Install via SteamCMD
/opt/steamcmd/steamcmd.sh \
    +force_install_dir "$INSTALL_DIR" \
    +login anonymous \
    +app_update $APP_ID validate \
    +quit

# Start server
cd "$INSTALL_DIR"
exec ./srcds_run \
    -game csgo \
    -console \
    -usercon \
    +game_type 0 \
    +game_mode 1 \
    +mapgroup mg_active \
    +map de_dust2 \
    -port ${SERVER_PORT:-27015} \
    +maxplayers ${MAX_PLAYERS:-10}
```

### Wine-based Server (Windows game)

```bash
#!/bin/bash
set -euo pipefail

echo "Installing Windows game server via Wine..."

cd /data

# Download Windows server
wget https://example.com/WindowsServer.exe
wine WindowsServer.exe /S  # Silent install

# Start with Wine
cd /data/ServerDir
exec wine ServerBinary.exe -port ${SERVER_PORT:-27015}
```

## Environment Variables

The script receives all environment variables passed to the container:

- `SERVER_PORT` - Game server port
- `MAX_PLAYERS` - Maximum players
- `SERVER_NAME` - Server name
- Custom variables as needed

## Volumes

- `/data` - Persistent game server data
- `/startup/server_init.sh` - Custom startup script (read-only)

## Troubleshooting

### Script Not Executing

1. Check script permissions: `ls -l /startup/server_init.sh`
2. Verify script format: `file /startup/server_init.sh`
3. Check for Windows line endings: `dos2unix /startup/server_init.sh`

### Server Exits Immediately

- Ensure the final command uses `exec` and runs in foreground
- Check logs: `docker logs <container_name>`

### Permission Denied

- Script must be readable by UID 1000
- Data volume must be writable by UID 1000

## Building in SpinUp

When integrated into SpinUp, the workflow is:

1. User creates "Custom" server type
2. User provides/generates startup script
3. Script is validated and stored in database
4. Container is created with script mounted
5. Container executes script and runs server

See `apps/api/src/workers/custom-server.worker.ts` for implementation.
