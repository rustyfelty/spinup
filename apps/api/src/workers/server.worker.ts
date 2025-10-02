import { Worker, Queue } from "bullmq";
import Docker from "dockerode";
import path from "node:path";
import fs from "node:fs/promises";
import { prisma } from "../services/prisma";
import { GAMES } from "@spinup/shared";

const docker = new Docker(); // Uses /var/run/docker.sock by default
const connection = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379")
};
const queue = new Queue("server-jobs", { connection });

export function startWorker() {
  const worker = new Worker(
    "server-jobs",
    async (job) => {
      const { serverId, jobId } = job.data;
      console.log(`Processing job ${job.name} for server ${serverId}`);

      try {
        const server = await prisma.server.findUnique({
          where: { id: serverId }
        });

        if (!server) {
          throw new Error(`Server ${serverId} not found`);
        }

        const game = GAMES.find(g => g.key === server.gameKey);
        if (!game) {
          throw new Error(`Unknown game: ${server.gameKey}`);
        }

        // Update job status
        await prisma.job.update({
          where: { id: jobId },
          data: {
            status: "RUNNING",
            startedAt: new Date()
          }
        });

        const root = process.env.DATA_DIR || "/srv/spinup";
        const serverPath = path.join(root, server.id);
        const dataPath = path.join(serverPath, "data");

        switch (job.name) {
          case "CREATE": {
            // Create data directory
            await fs.mkdir(dataPath, { recursive: true });

            // Pull Docker image
            await pullImage(game.image);
            job.updateProgress(30);

            // Handle custom servers differently
            let portMappings;
            let binds = [`${dataPath}:${game.volumePaths.data}`];
            let envVars = game.envDefaults
              ? Object.entries(game.envDefaults).map(([k, v]) => `${k}=${v}`)
              : [];

            if (game.key === "custom") {
              // Load custom script for this server
              const customScript = await prisma.customScript.findUnique({
                where: { serverId: server.id }
              });

              if (!customScript) {
                // Create a placeholder script that waits indefinitely
                const placeholderScript = `#!/bin/bash
set -euo pipefail

echo "============================================"
echo " Custom Server Container Started"
echo "============================================"
echo ""
echo "This server needs configuration via the AI Setup tab."
echo "Please use the AI Setup tab to generate a server script."
echo ""
echo "Container will stay running and wait for configuration..."
echo ""

# Keep container alive
exec tail -f /dev/null
`;
                const scriptPath = path.join(dataPath, "server_init.sh");
                await fs.writeFile(scriptPath, placeholderScript, { mode: 0o755 });

                // Mount script into container
                binds.push(`${scriptPath}:/startup/server_init.sh:ro`);

                // Use default port
                portMappings = [{
                  container: 27015,
                  host: await allocateHostPort(27015),
                  proto: "tcp" as const
                }];
              } else {
                // Write custom script to startup directory
                const scriptPath = path.join(dataPath, "server_init.sh");
                await fs.writeFile(scriptPath, customScript.content, { mode: 0o755 });

                // Mount script into container
                binds.push(`${scriptPath}:/startup/server_init.sh:ro`);

                // Use ports from custom script
                const portSpecs = customScript.portSpecs as any[];
                portMappings = await Promise.all(
                  portSpecs.map(async (p) => ({
                    container: p.container,
                    host: await allocateHostPort(p.container),
                    proto: p.proto
                  }))
                );
              }

              // Add custom environment variables (if script exists)
              if (customScript) {
                const customEnv = customScript.envVars as Record<string, string>;
                envVars = [
                  ...envVars,
                  ...Object.entries(customEnv || {}).map(([k, v]) => `${k}=${v}`)
                ];

                console.log(`[CUSTOM] Created custom server with script hash: ${customScript.scriptHash}`);
              }
            } else {
              // Standard game server
              portMappings = await Promise.all(
                game.ports.map(async (p) => ({
                  container: p.container,
                  host: await allocateHostPort(p.container),
                  proto: p.proto
                }))
              );
            }

            job.updateProgress(60);

            // Create container
            const containerConfig: Docker.ContainerCreateOptions = {
              Image: game.image,
              name: `su_${server.id}`,
              Hostname: `spinup-${server.name}`,
              ExposedPorts: Object.fromEntries(
                portMappings.map(p => [`${p.container}/${p.proto}`, {}])
              ),
              HostConfig: {
                Binds: binds,
                PortBindings: Object.fromEntries(
                  portMappings.map(p => [
                    `${p.container}/${p.proto}`,
                    [{ HostPort: String(p.host) }]
                  ])
                ),
                RestartPolicy: { Name: "unless-stopped" },
                Memory: server.memoryCap * 1024 * 1024, // Convert MB to bytes
                MemorySwap: server.memoryCap * 1024 * 1024, // Disable swap
                CpuShares: server.cpuShares,
                SecurityOpt: ["no-new-privileges:true"] // Extra security for custom servers
              },
              Env: envVars
            };

            const container = await docker.createContainer(containerConfig);

            // Update server with container ID and ports
            await prisma.server.update({
              where: { id: serverId },
              data: {
                containerId: container.id,
                ports: portMappings,
                status: "STOPPED"
              }
            });

            job.updateProgress(100);
            break;
          }

          case "START": {
            if (!server.containerId) {
              throw new Error("No container ID found");
            }

            const container = docker.getContainer(server.containerId);

            // Check if container exists
            try {
              await container.inspect();
            } catch (err: any) {
              if (err.statusCode === 404) {
                throw new Error("Container not found");
              }
              throw err;
            }

            // Start container
            await container.start();

            // Update server status
            await prisma.server.update({
              where: { id: serverId },
              data: { status: "RUNNING" }
            });

            job.updateProgress(100);
            break;
          }

          case "STOP": {
            if (!server.containerId) {
              throw new Error("No container ID found");
            }

            const container = docker.getContainer(server.containerId);

            try {
              // Stop container gracefully (15 second timeout)
              await container.stop({ t: 15 });
            } catch (err: any) {
              // Container might already be stopped
              if (err.statusCode !== 304) {
                throw err;
              }
            }

            // Update server status
            await prisma.server.update({
              where: { id: serverId },
              data: { status: "STOPPED" }
            });

            job.updateProgress(100);
            break;
          }

          case "DELETE": {
            if (server.containerId) {
              const container = docker.getContainer(server.containerId);

              try {
                // Stop container if running
                await container.stop({ t: 10 });
              } catch (err: any) {
                // Ignore if already stopped
              }

              try {
                // Remove container
                await container.remove({ force: true });
              } catch (err: any) {
                // Ignore if already removed
              }
            }

            // Remove data directory
            try {
              await fs.rm(path.join(root, server.id), { recursive: true, force: true });
            } catch (err) {
              console.error("Failed to remove data directory:", err);
            }

            // Delete server from database
            await prisma.server.delete({
              where: { id: serverId }
            });

            job.updateProgress(100);
            break;
          }

          case "RESTART": {
            if (!server.containerId) {
              throw new Error("No container ID found");
            }

            const container = docker.getContainer(server.containerId);

            // Restart container
            await container.restart({ t: 15 });

            // Update server status
            await prisma.server.update({
              where: { id: serverId },
              data: { status: "RUNNING" }
            });

            job.updateProgress(100);
            break;
          }

          default:
            throw new Error(`Unknown job type: ${job.name}`);
        }

        // Mark job as successful
        await prisma.job.update({
          where: { id: jobId },
          data: {
            status: "SUCCESS",
            finishedAt: new Date(),
            progress: 100
          }
        });

      } catch (error: any) {
        console.error(`Job ${job.name} failed for server ${serverId}:`, error);

        // Mark job as failed
        await prisma.job.update({
          where: { id: jobId },
          data: {
            status: "FAILED",
            finishedAt: new Date(),
            error: error.message
          }
        });

        // Update server status to ERROR if creation failed
        if (job.name === "CREATE") {
          await prisma.server.update({
            where: { id: serverId },
            data: { status: "ERROR" }
          });
        }

        throw error;
      }
    },
    {
      connection,
      concurrency: 5,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 100 }
    }
  );

  worker.on("completed", (job) => {
    console.log(`Job ${job.name} completed for ${job.data.serverId}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`Job ${job?.name} failed:`, err.message);
  });

  console.log("✅ Server worker started");
  return worker;
}

async function pullImage(image: string): Promise<void> {
  return new Promise((resolve, reject) => {
    docker.pull(image, {}, (err: any, stream: any) => {
      if (err) {
        return reject(err);
      }

      docker.modem.followProgress(
        stream,
        (err: any) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        },
        (event: any) => {
          // Log progress events
          if (event.status) {
            console.log(`Pulling ${image}: ${event.status}`);
          }
        }
      );
    });
  });
}

/**
 * Allocate a host port - uses 1:1 mapping (same port on host and container)
 * This eliminates port mapping confusion for game servers
 */
async function allocateHostPort(containerPort: number): Promise<number> {
  // Get all allocated ports from existing servers
  const servers = await prisma.server.findMany({
    where: {
      ports: {
        not: { equals: [] }
      }
    },
    select: { ports: true }
  });

  const allocatedPorts = new Set<number>();
  for (const server of servers) {
    const ports = server.ports as any[];
    if (Array.isArray(ports)) {
      for (const portMapping of ports) {
        if (portMapping && typeof portMapping.host === 'number') {
          allocatedPorts.add(portMapping.host);
        }
      }
    }
  }

  // Use 1:1 mapping - try to allocate the same port number
  // Range: 30000-40000 for game servers
  const minPort = 30000;
  const maxPort = 40000;

  // Start from the container port if it's in range, otherwise start from minPort
  let candidatePort = (containerPort >= minPort && containerPort <= maxPort)
    ? containerPort
    : minPort;

  while (candidatePort <= maxPort) {
    if (!allocatedPorts.has(candidatePort)) {
      return candidatePort;
    }
    candidatePort++;
  }

  throw new Error(`No available ports in range ${minPort}-${maxPort}`);
}

// Export queue for use in routes
export { queue as serverQueue };