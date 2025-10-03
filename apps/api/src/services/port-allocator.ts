import Docker from 'dockerode';
import { prisma } from './prisma';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const docker = new Docker();

/**
 * Port Allocator Service
 *
 * Allocates host ports for game servers in the range 30000-40000.
 *
 * CRITICAL BUG (to be fixed in GREEN phase):
 * - Currently only checks database for allocated ports
 * - Does NOT check Docker daemon for ports in use
 * - Does NOT check system (lsof/netstat) for port availability
 * - This causes orphaned containers to hold ports invisibly
 */

/**
 * Allocate a host port - uses 1:1 mapping (same port on host and container)
 * This eliminates port mapping confusion for game servers
 * @param containerPort - The container port to allocate for
 * @param allocatedInJob - Ports already allocated in this job (to avoid conflicts when allocating multiple ports)
 */
export async function allocateHostPort(
  containerPort: number,
  allocatedInJob: Set<number> = new Set()
): Promise<number> {
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

  // Also include ports allocated in this job
  for (const port of allocatedInJob) {
    allocatedPorts.add(port);
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
    // Check database allocation
    if (allocatedPorts.has(candidatePort)) {
      candidatePort++;
      continue;
    }

    // GREEN PHASE: Check if port is used by Docker
    const dockerInUse = await isPortUsedByDocker(candidatePort);
    if (dockerInUse) {
      candidatePort++;
      continue;
    }

    // GREEN PHASE: Check if port is used by system
    const systemInUse = await isPortUsedBySystem(candidatePort);
    if (systemInUse) {
      candidatePort++;
      continue;
    }

    // Port is free!
    return candidatePort;
  }

  throw new Error(`No available ports in range ${minPort}-${maxPort}`);
}

/**
 * Check if a port is in use by Docker containers
 * @param port - The port to check
 * @returns True if port is in use by any Docker container
 */
export async function isPortUsedByDocker(port: number): Promise<boolean> {
  try {
    // List ALL containers (running and stopped)
    const containers = await docker.listContainers({ all: true });

    for (const containerInfo of containers) {
      if (!containerInfo.Ports) continue;

      // Check each port binding
      for (const portBinding of containerInfo.Ports) {
        if (portBinding.PublicPort === port) {
          return true;
        }
      }
    }

    return false;
  } catch (err: any) {
    console.error('Error checking Docker ports:', err);
    // Fail safe - assume port might be in use if we can't check
    return true;
  }
}

/**
 * Check if a port is in use on the system (using lsof)
 * @param port - The port to check
 * @returns True if port is in use
 */
export async function isPortUsedBySystem(port: number): Promise<boolean> {
  // TODO (GREEN PHASE): Implement system port checking
  try {
    const { stdout } = await execAsync(`lsof -i :${port}`);
    return stdout.trim().length > 0;
  } catch (err: any) {
    // lsof returns exit code 1 if no processes found
    if (err.code === 1) {
      return false;
    }
    // For other errors, assume port might be in use (fail safe)
    return true;
  }
}
