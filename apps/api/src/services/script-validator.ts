import crypto from "node:crypto";

/**
 * Security validation for custom server scripts
 */

// Maximum script size: 64KB
const MAX_SCRIPT_SIZE = 65536;

// Dangerous patterns to block
const DANGEROUS_PATTERNS = [
  {
    pattern: /rm\s+-rf\s+\//,
    message: "Detected attempt to delete root filesystem (rm -rf /)"
  },
  {
    pattern: /curl[^|]*\|\s*(bash|sh|zsh)/,
    message: "Detected pipe to shell from curl (curl | sh)"
  },
  {
    pattern: /wget[^|]*\|\s*(bash|sh|zsh)/,
    message: "Detected pipe to shell from wget (wget | sh)"
  },
  {
    pattern: /eval\s+['"`$]/,
    message: "Detected eval command with variable expansion"
  },
  {
    pattern: /__import__\s*\(\s*['"]os['"]\s*\)\s*\.\s*system/,
    message: "Detected Python os.system() call"
  },
  {
    pattern: /exec\s*\(\s*['"]rm/,
    message: "Detected Python exec() with rm command"
  },
  {
    pattern: /nc\s+-[el]/,
    message: "Detected netcat listener (potential reverse shell)"
  },
  {
    pattern: /\/dev\/tcp\//,
    message: "Detected /dev/tcp usage (potential reverse shell)"
  },
  {
    pattern: /chmod\s+[0-7]*[7]/,
    message: "Detected chmod with world-writable permissions"
  },
  {
    pattern: /dd\s+if=\/dev\/zero\s+of=/,
    message: "Detected dd command (potential disk fill attack)"
  }
];

// Suspicious but potentially legitimate patterns (warnings only)
const WARNING_PATTERNS = [
  {
    pattern: /rm\s+-rf/,
    message: "Uses recursive force delete (rm -rf)"
  },
  {
    pattern: /sudo\s+/,
    message: "Attempts to use sudo (will fail - container is non-root)"
  },
  {
    pattern: /docker\s+/,
    message: "References Docker commands (not available in container)"
  },
  {
    pattern: /apt-get\s+install|yum\s+install|apk\s+add/,
    message: "Installs packages (may fail if not in PATH or already installed)"
  }
];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  hash: string;
  size: number;
}

/**
 * Validate a custom server script for security issues
 */
export function validateScript(content: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check size
  const size = Buffer.byteLength(content, 'utf-8');
  if (size > MAX_SCRIPT_SIZE) {
    errors.push(`Script too large: ${size} bytes (max ${MAX_SCRIPT_SIZE} bytes / 64KB)`);
  }

  // Check for dangerous patterns
  for (const { pattern, message } of DANGEROUS_PATTERNS) {
    if (pattern.test(content)) {
      errors.push(message);
    }
  }

  // Check for warning patterns
  for (const { pattern, message } of WARNING_PATTERNS) {
    if (pattern.test(content)) {
      warnings.push(message);
    }
  }

  // Compute SHA-256 hash
  const hash = crypto.createHash('sha256').update(content).digest('hex');

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    hash,
    size
  };
}

/**
 * Sanitize script content for safe storage
 * - Converts to UTF-8
 * - Normalizes line endings to \n
 * - Removes null bytes
 */
export function sanitizeScript(content: string): string {
  return content
    .replace(/\r\n/g, '\n')  // Convert CRLF to LF
    .replace(/\r/g, '\n')     // Convert CR to LF
    .replace(/\0/g, '');      // Remove null bytes
}

/**
 * Verify script hash matches stored hash
 */
export function verifyScriptHash(content: string, expectedHash: string): boolean {
  const actualHash = crypto.createHash('sha256').update(content).digest('hex');
  return actualHash === expectedHash;
}

/**
 * Extract required ports from script content
 * Looks for common patterns like PORT=8080 or -port 27015
 */
export function extractPortsFromScript(content: string): number[] {
  const ports: Set<number> = new Set();

  // Match PORT=8080, SERVER_PORT=27015, etc.
  const envPortPattern = /(?:SERVER_|GAME_)?PORT[S]?\s*[:=]\s*(\d+)/gi;
  let match;
  while ((match = envPortPattern.exec(content)) !== null) {
    const port = parseInt(match[1], 10);
    if (port >= 1024 && port <= 65535) {
      ports.add(port);
    }
  }

  // Match -port 27015, --port=8080, etc.
  const flagPortPattern = /--?port[=\s]+(\d+)/gi;
  while ((match = flagPortPattern.exec(content)) !== null) {
    const port = parseInt(match[1], 10);
    if (port >= 1024 && port <= 65535) {
      ports.add(port);
    }
  }

  return Array.from(ports).sort((a, b) => a - b);
}

/**
 * Generate a simple example script template
 */
export function generateExampleScript(gameName: string): string {
  return `#!/bin/bash
set -euo pipefail

echo "Installing ${gameName} Server..."

# Set working directory
cd /data

# TODO: Download and install your game server
# Example: wget https://example.com/server.tar.gz
# Example: tar -xzf server.tar.gz

# TODO: Configure server
# You can use environment variables: \${SERVER_PORT}, \${SERVER_NAME}, etc.

# TODO: Start server (must run in foreground, use 'exec')
# Example: exec ./server_binary -port \${SERVER_PORT:-27015}

echo "Script template - replace this with your server installation logic"
sleep infinity
`;
}
