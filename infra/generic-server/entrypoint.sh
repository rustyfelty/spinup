#!/bin/bash
set -euo pipefail

echo "=== SpinUp Generic Server Container ==="
echo "Starting at $(date)"
echo

# Check if custom startup script exists
SCRIPT_PATH="/startup/server_init.sh"

if [ ! -f "$SCRIPT_PATH" ]; then
    echo "ERROR: No startup script found at $SCRIPT_PATH"
    echo "The container expects a custom script to be mounted at this location."
    exit 1
fi

echo "Found startup script: $SCRIPT_PATH"
echo "Script size: $(wc -c < "$SCRIPT_PATH") bytes"
echo "Script hash: $(sha256sum "$SCRIPT_PATH" | awk '{print $1}')"
echo

# Verify script is readable and executable
if [ ! -r "$SCRIPT_PATH" ]; then
    echo "ERROR: Script is not readable"
    exit 1
fi

chmod +x "$SCRIPT_PATH"

echo "--- BEGIN CUSTOM SCRIPT EXECUTION ---"
echo

# Execute the custom startup script
# This script should:
# 1. Download/install the game server
# 2. Configure the server
# 3. Start the server process (as foreground process)
exec "$SCRIPT_PATH"
