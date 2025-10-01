import { prisma } from "../services/prisma";
import { JobType } from "@prisma/client";
import { serverQueue } from "./server.worker";

/**
 * Enqueue a CREATE job for a server
 */
export async function enqueueCreate(serverId: string) {
  const dbJob = await prisma.job.create({
    data: {
      serverId,
      type: JobType.CREATE,
      status: "PENDING",
      progress: 0,
      payload: {},
      logs: ""
    }
  });

  // Add to BullMQ queue
  await serverQueue.add("CREATE", { serverId, jobId: dbJob.id });

  return dbJob;
}

/**
 * Enqueue a START job for a server
 */
export async function enqueueStart(serverId: string) {
  const dbJob = await prisma.job.create({
    data: {
      serverId,
      type: JobType.START,
      status: "PENDING",
      progress: 0,
      payload: {},
      logs: ""
    }
  });

  // Add to BullMQ queue
  await serverQueue.add("START", { serverId, jobId: dbJob.id });

  return dbJob;
}

/**
 * Enqueue a STOP job for a server
 */
export async function enqueueStop(serverId: string) {
  const dbJob = await prisma.job.create({
    data: {
      serverId,
      type: JobType.STOP,
      status: "PENDING",
      progress: 0,
      payload: {},
      logs: ""
    }
  });

  // Add to BullMQ queue
  await serverQueue.add("STOP", { serverId, jobId: dbJob.id });

  return dbJob;
}

/**
 * Enqueue a DELETE job for a server
 */
export async function enqueueDelete(serverId: string) {
  const dbJob = await prisma.job.create({
    data: {
      serverId,
      type: JobType.DELETE,
      status: "PENDING",
      progress: 0,
      payload: {},
      logs: ""
    }
  });

  // Add to BullMQ queue
  await serverQueue.add("DELETE", { serverId, jobId: dbJob.id });

  return dbJob;
}
