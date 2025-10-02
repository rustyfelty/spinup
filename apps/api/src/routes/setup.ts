import { FastifyPluginCallback } from "fastify";
import { randomBytes } from "crypto";
import { writeFileSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Check if the system is already configured
function isSystemConfigured(): boolean {
  const envPath = join(process.cwd(), "../../.env");

  if (!existsSync(envPath)) {
    return false;
  }

  const envContent = readFileSync(envPath, "utf-8");

  // Check if critical secrets are set (not the example values)
  const hasJwtSecret = envContent.includes("API_JWT_SECRET=") &&
    envContent.match(/API_JWT_SECRET=([^\n]+)/)?.[1]?.length >= 32;
  const hasServiceToken = envContent.includes("SERVICE_TOKEN=") &&
    envContent.match(/SERVICE_TOKEN=([^\n]+)/)?.[1]?.length >= 32;
  const hasPostgresPassword = envContent.includes("POSTGRES_PASSWORD=") &&
    envContent.match(/POSTGRES_PASSWORD=([^\n]+)/)?.[1]?.length >= 16;

  return !!(hasJwtSecret && hasServiceToken && hasPostgresPassword);
}

export const setupRoutes: FastifyPluginCallback = (app, _opts, done) => {
  // Check setup status
  app.get("/status", async (req, reply) => {
    const configured = isSystemConfigured();

    return reply.send({
      configured,
      message: configured
        ? "System is configured and ready"
        : "System needs initial configuration"
    });
  });

  // Get setup form (HTML page)
  app.get("/", async (req, reply) => {
    if (isSystemConfigured()) {
      return reply.redirect("/");
    }

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SpinUp Setup</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 2rem;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    .card {
      background: white;
      border-radius: 1rem;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 2rem;
      text-align: center;
    }
    .header h1 {
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
    }
    .header p {
      opacity: 0.9;
      font-size: 1.1rem;
    }
    .content {
      padding: 2rem;
    }
    .form-group {
      margin-bottom: 1.5rem;
    }
    label {
      display: block;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: #2d3748;
    }
    input {
      width: 100%;
      padding: 0.75rem;
      border: 2px solid #e2e8f0;
      border-radius: 0.5rem;
      font-size: 1rem;
      transition: border-color 0.2s;
    }
    input:focus {
      outline: none;
      border-color: #667eea;
    }
    .help-text {
      font-size: 0.875rem;
      color: #718096;
      margin-top: 0.25rem;
    }
    .btn {
      background: #667eea;
      color: white;
      border: none;
      padding: 1rem 2rem;
      border-radius: 0.5rem;
      font-size: 1.1rem;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
      transition: all 0.2s;
    }
    .btn:hover {
      background: #5a67d8;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
    .btn:disabled {
      background: #cbd5e0;
      cursor: not-allowed;
      transform: none;
    }
    .alert {
      padding: 1rem;
      border-radius: 0.5rem;
      margin-bottom: 1.5rem;
    }
    .alert-info {
      background: #ebf8ff;
      border: 1px solid #90cdf4;
      color: #2c5282;
    }
    .alert-success {
      background: #f0fff4;
      border: 1px solid #9ae6b4;
      color: #22543d;
    }
    .alert-error {
      background: #fff5f5;
      border: 1px solid #fc8181;
      color: #742a2a;
    }
    .section-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: #2d3748;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid #e2e8f0;
    }
    .loading {
      display: none;
      text-align: center;
      padding: 2rem;
    }
    .loading.active {
      display: block;
    }
    .spinner {
      border: 3px solid #e2e8f0;
      border-top: 3px solid #667eea;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <h1>🚀 SpinUp Setup</h1>
        <p>Let's get your game server management platform configured</p>
      </div>
      <div class="content">
        <div id="alert"></div>

        <form id="setupForm">
          <div class="section-title">Basic Configuration</div>

          <div class="form-group">
            <label for="webOrigin">Web URL</label>
            <input type="url" id="webOrigin" name="webOrigin" required
                   placeholder="https://spinup.yourdomain.com" value="${process.env.WEB_ORIGIN || ''}">
            <div class="help-text">The public URL where users will access SpinUp</div>
          </div>

          <div class="form-group">
            <label for="apiUrl">API URL</label>
            <input type="url" id="apiUrl" name="apiUrl" required
                   placeholder="https://api.spinup.yourdomain.com" value="${process.env.API_URL || ''}">
            <div class="help-text">The public URL for the API server</div>
          </div>

          <div class="section-title">Database Configuration</div>

          <div class="form-group">
            <label for="databaseUrl">Database URL</label>
            <input type="text" id="databaseUrl" name="databaseUrl" required
                   placeholder="postgresql://spinup:password@localhost:5432/spinup"
                   value="${process.env.DATABASE_URL || 'postgresql://spinup:spinup@localhost:5432/spinup'}">
            <div class="help-text">PostgreSQL connection string</div>
          </div>

          <div class="section-title">Optional: Discord Bot (Can be added later)</div>

          <div class="form-group">
            <label for="discordToken">Discord Bot Token</label>
            <input type="text" id="discordToken" name="discordToken"
                   placeholder="Leave empty to skip Discord integration">
            <div class="help-text">Get this from Discord Developer Portal</div>
          </div>

          <div class="form-group">
            <label for="discordClientId">Discord Client ID</label>
            <input type="text" id="discordClientId" name="discordClientId"
                   placeholder="Leave empty to skip Discord integration">
          </div>

          <div class="form-group">
            <label for="discordClientSecret">Discord Client Secret</label>
            <input type="text" id="discordClientSecret" name="discordClientSecret"
                   placeholder="Leave empty to skip Discord integration">
          </div>

          <button type="submit" class="btn" id="submitBtn">Complete Setup</button>
        </form>

        <div class="loading" id="loading">
          <div class="spinner"></div>
          <p>Setting up your SpinUp instance...</p>
        </div>
      </div>
    </div>
  </div>

  <script>
    const form = document.getElementById('setupForm');
    const loading = document.getElementById('loading');
    const submitBtn = document.getElementById('submitBtn');
    const alertDiv = document.getElementById('alert');

    function showAlert(message, type = 'info') {
      alertDiv.className = 'alert alert-' + type;
      alertDiv.textContent = message;
      alertDiv.style.display = 'block';
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const formData = new FormData(form);
      const data = Object.fromEntries(formData);

      try {
        form.style.display = 'none';
        loading.classList.add('active');
        alertDiv.style.display = 'none';

        const response = await fetch('/api/setup/install', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
          showAlert(result.message || 'Setup completed successfully!', 'success');
          setTimeout(() => {
            window.location.href = data.webOrigin || '/';
          }, 2000);
        } else {
          form.style.display = 'block';
          loading.classList.remove('active');
          showAlert(result.error || 'Setup failed. Please try again.', 'error');
        }
      } catch (error) {
        form.style.display = 'block';
        loading.classList.remove('active');
        showAlert('Setup failed: ' + error.message, 'error');
      }
    });
  </script>
</body>
</html>
    `;

    return reply.type("text/html").send(html);
  });

  // Perform installation
  app.post("/install", async (req, reply) => {
    try {
      if (isSystemConfigured()) {
        return reply.code(400).send({
          error: "System is already configured. Delete .env file to reconfigure."
        });
      }

      const {
        webOrigin,
        apiUrl,
        databaseUrl,
        discordToken,
        discordClientId,
        discordClientSecret
      } = req.body as {
        webOrigin: string;
        apiUrl: string;
        databaseUrl: string;
        discordToken?: string;
        discordClientId?: string;
        discordClientSecret?: string;
      };

      // Validate required fields
      if (!webOrigin || !apiUrl || !databaseUrl) {
        return reply.code(400).send({
          error: "Missing required fields: webOrigin, apiUrl, databaseUrl"
        });
      }

      // Generate secure secrets
      const jwtSecret = randomBytes(32).toString("hex");
      const serviceToken = randomBytes(32).toString("hex");
      const postgresPassword = randomBytes(16).toString("hex");

      // Build .env content
      const envContent = `# SpinUp Configuration - Generated by Setup Wizard
# DO NOT SHARE THIS FILE - IT CONTAINS SECRETS

# ====================================
# DATABASE
# ====================================
DATABASE_URL=${databaseUrl}

# ====================================
# API CONFIGURATION
# ====================================
API_PORT=8080
API_URL=${apiUrl}

# ====================================
# WEB CONFIGURATION
# ====================================
WEB_ORIGIN=${webOrigin}
VITE_PORT=5173
VITE_API_URL=

# ====================================
# DISCORD BOT (Optional)
# ====================================
${discordToken ? `DISCORD_TOKEN=${discordToken}` : 'DISCORD_TOKEN='}
${discordClientId ? `DISCORD_CLIENT_ID=${discordClientId}` : 'DISCORD_CLIENT_ID='}
${discordClientSecret ? `DISCORD_CLIENT_SECRET=${discordClientSecret}` : 'DISCORD_CLIENT_SECRET='}
${webOrigin ? `DISCORD_REDIRECT_URI=${webOrigin}/auth/discord/callback` : 'DISCORD_REDIRECT_URI='}

# ====================================
# REDIS
# ====================================
REDIS_HOST=localhost
REDIS_PORT=6379

# ====================================
# DATA STORAGE
# ====================================
DATA_DIR=/srv/spinup

# ====================================
# ENVIRONMENT
# ====================================
NODE_ENV=production

# ====================================
# DOCKER
# ====================================
DOCKER_HOST=unix:///var/run/docker.sock

# ====================================
# SECURITY (AUTO-GENERATED)
# ====================================
RATE_LIMIT_MAX=100
RATE_LIMIT_TIMEWINDOW=60000
SESSION_MAX_AGE=86400000
API_JWT_SECRET=${jwtSecret}
SERVICE_TOKEN=${serviceToken}
POSTGRES_PASSWORD=${postgresPassword}
`;

      // Write .env file
      const envPath = join(process.cwd(), "../../.env");
      writeFileSync(envPath, envContent, { mode: 0o600 });

      app.log.info("Configuration file created successfully");

      // Run database migrations
      try {
        app.log.info("Running database migrations...");
        const { stdout, stderr } = await execAsync("cd ../.. && pnpm db:push", {
          cwd: process.cwd()
        });
        app.log.info("Database migrations completed", { stdout, stderr });
      } catch (migrationError: any) {
        app.log.warn("Database migration warning (may be safe to ignore):", migrationError.message);
      }

      return reply.send({
        success: true,
        message: "Setup completed! Redirecting to your SpinUp instance...",
        webOrigin
      });

    } catch (error: any) {
      app.log.error("Setup failed:", error);
      return reply.code(500).send({
        error: "Setup failed: " + error.message
      });
    }
  });

  done();
};
