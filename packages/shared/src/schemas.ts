import { z } from "zod";

// Minecraft server.properties configuration (subset of most important settings)
export const mcConfigSchema = z.object({
  level_name: z.string().default("world"),
  difficulty: z.enum(["peaceful", "easy", "normal", "hard"]).default("easy"),
  max_players: z.coerce.number().int().min(1).max(100).default(10),
  online_mode: z.enum(["true", "false"]).default("true"),
  pvp: z.enum(["true", "false"]).default("true"),
  motd: z.string().default("A Minecraft Server"),
  gamemode: z.enum(["survival", "creative", "adventure", "spectator"]).default("survival"),
  spawn_protection: z.coerce.number().int().min(0).max(16).default(16),
  view_distance: z.coerce.number().int().min(2).max(32).default(10),
  enable_command_block: z.enum(["true", "false"]).default("false"),
  allow_flight: z.enum(["true", "false"]).default("false"),
  white_list: z.enum(["true", "false"]).default("false")
});

export type McConfig = z.infer<typeof mcConfigSchema>;

// Server creation schema
export const createServerSchema = z.object({
  orgId: z.string().cuid(),
  name: z.string()
    .min(3, "Server name must be at least 3 characters")
    .max(50, "Server name must be at most 50 characters")
    .regex(/^[a-z0-9-]+$/, "Server name must contain only lowercase letters, numbers, and hyphens"),
  gameKey: z.string()
});

// Server update schema
export const updateServerSchema = z.object({
  name: z.string()
    .min(3, "Server name must be at least 3 characters")
    .max(50, "Server name must be at most 50 characters")
    .regex(/^[a-z0-9-]+$/, "Server name must contain only lowercase letters, numbers, and hyphens")
    .optional()
});

// Auth schemas
export const magicLinkIssueSchema = z.object({
  discordUserId: z.string(),
  discordGuildId: z.string(),
  displayName: z.string().optional(),
  avatarUrl: z.string().url().optional()
});

export const magicLinkConsumeSchema = z.object({
  token: z.string().jwt()
});

// Job schemas
export const jobTypeSchema = z.enum(["CREATE", "START", "STOP", "DELETE", "RESTART", "BACKUP", "RESTORE", "PULL"]);
export const jobStatusSchema = z.enum(["PENDING", "RUNNING", "SUCCESS", "FAILED"]);

// Server status schema
export const serverStatusSchema = z.enum(["CREATING", "RUNNING", "STOPPED", "ERROR", "DELETING"]);

export type ServerStatus = z.infer<typeof serverStatusSchema>;
export type JobType = z.infer<typeof jobTypeSchema>;
export type JobStatus = z.infer<typeof jobStatusSchema>;