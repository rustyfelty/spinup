// Common type definitions shared across the application

import type { ServerStatus, JobType, JobStatus } from './schemas';

export interface User {
  id: string;
  discordId: string;
  displayName: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Organization {
  id: string;
  discordGuild: string; // Keep for backwards compatibility
  discordGuildId: string;
  discordGuildName?: string;
  discordIconHash?: string;
  discordBannerHash?: string;
  discordDescription?: string;
  discordOwnerDiscordId?: string;
  name: string;
  iconUrl?: string;
  defaultChannelId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Membership {
  id: string;
  userId: string;
  orgId: string;
  role: MemberRole;
  createdAt: Date;
}

export enum MemberRole {
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  OPERATOR = "OPERATOR",
  VIEWER = "VIEWER"
}

export interface Server {
  id: string;
  orgId: string;
  name: string;
  gameKey: string;
  status: ServerStatus;
  ports: PortMapping[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  containerId?: string;
}

export interface PortMapping {
  container: number;
  host: number;
  proto: "tcp" | "udp";
}

// ServerStatus is exported from schemas.ts
// export type ServerStatus = "CREATING" | "RUNNING" | "STOPPED" | "ERROR" | "DELETING";

export interface Job {
  id: string;
  serverId: string;
  type: JobType;
  status: JobStatus;
  progress: number;
  payload: any;
  logs: string;
  error?: string;
  startedAt?: Date;
  finishedAt?: Date;
}

// JobType and JobStatus are exported from schemas.ts
// export type JobType = "CREATE" | "START" | "STOP" | "DELETE" | "RESTART" | "BACKUP" | "RESTORE" | "PULL";
// export type JobStatus = "PENDING" | "RUNNING" | "SUCCESS" | "FAILED";

export interface ConfigVersion {
  id: string;
  serverId: string;
  schemaVersion: string;
  values: Record<string, any>;
  createdAt: Date;
  createdBy: string;
}

export interface LoginToken {
  jti: string;
  userId: string;
  orgId: string;
  expiresAt: Date;
  usedAt?: Date;
}

export interface PairingCode {
  code: string;
  userId: string;
  orgId: string;
  expiresAt: Date;
  usedAt?: Date;
}

export interface Audit {
  id: string;
  actorId?: string;
  orgId?: string;
  action: string;
  target: string;
  meta: Record<string, any>;
  at: Date;
}

export interface Backup {
  id: string;
  serverId: string;
  location: string;
  sizeBytes: number;
  createdAt: Date;
  notes?: string;
}

// API Response types
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Discord types
export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar?: string;
  bot?: boolean;
  system?: boolean;
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon?: string;
  owner?: boolean;
  permissions?: string;
}