export type PortSpec = {
  container: number;
  proto: "tcp" | "udp"
};

export type ResourceSpec = {
  cpu: number;        // CPU shares (1024 = 1 core)
  memory: number;     // Memory in MB
  description: string;
};

export type GameImage = {
  key: string;
  name: string;
  image: string;
  ports: PortSpec[];
  envDefaults?: Record<string, string>;
  volumePaths: {
    data: string;
    config?: string
  };
  resources: {
    recommended: ResourceSpec;
    minimum: ResourceSpec;
    maximum?: ResourceSpec;
  };
  scaling?: {
    playersPerGB: number;
    playersPerCore: number;
  };
};

export const GAMES: GameImage[] = [
  {
    key: "minecraft-java",
    name: "Minecraft (Java)",
    image: "itzg/minecraft-server:latest",
    ports: [{ container: 25565, proto: "tcp" }],
    envDefaults: {
      EULA: "TRUE",
      MEMORY: "2G",
      TYPE: "VANILLA",
      VERSION: "LATEST"
    },
    volumePaths: { data: "/data" },
    resources: {
      minimum: { cpu: 1024, memory: 1024, description: "Basic vanilla server, 1-5 players" },
      recommended: { cpu: 2048, memory: 2048, description: "Smooth gameplay, 10-20 players" },
      maximum: { cpu: 4096, memory: 8192, description: "High performance, 50+ players or modded" }
    },
    scaling: { playersPerGB: 10, playersPerCore: 20 }
  },
  {
    key: "minecraft-bedrock",
    name: "Minecraft (Bedrock)",
    image: "itzg/minecraft-bedrock-server:latest",
    ports: [{ container: 19132, proto: "udp" }],
    envDefaults: { EULA: "TRUE" },
    volumePaths: { data: "/data" },
    resources: {
      minimum: { cpu: 1024, memory: 1024, description: "Basic server, 1-5 players" },
      recommended: { cpu: 2048, memory: 2048, description: "Smooth performance, 10-15 players" },
      maximum: { cpu: 3072, memory: 4096, description: "Large worlds, 30+ players" }
    },
    scaling: { playersPerGB: 8, playersPerCore: 15 }
  },
  {
    key: "7dtd",
    name: "7 Days to Die",
    image: "didstopia/7dtd-server:latest",
    ports: [
      { container: 26900, proto: "udp" },
      { container: 26901, proto: "udp" }
    ],
    volumePaths: { data: "/steamcmd/7dtd" },
    resources: {
      minimum: { cpu: 2048, memory: 4096, description: "Small map, 4-8 players" },
      recommended: { cpu: 3072, memory: 6144, description: "Medium map, 8-16 players" },
      maximum: { cpu: 4096, memory: 12288, description: "Large map, 16-32 players" }
    },
    scaling: { playersPerGB: 2, playersPerCore: 8 }
  },
  {
    key: "valheim",
    name: "Valheim",
    image: "lloesche/valheim-server:latest",
    ports: [
      { container: 2456, proto: "udp" },
      { container: 2457, proto: "udp" }
    ],
    envDefaults: {
      SERVER_NAME: "SpinUp Valheim",
      SERVER_PASS: "changeme",
      SERVER_PUBLIC: "1"
    },
    volumePaths: { data: "/config" },
    resources: {
      minimum: { cpu: 2048, memory: 2048, description: "Basic server, 2-4 players" },
      recommended: { cpu: 2048, memory: 4096, description: "Optimal performance, 4-8 players" },
      maximum: { cpu: 4096, memory: 8192, description: "Large world, 10 players" }
    },
    scaling: { playersPerGB: 2, playersPerCore: 5 }
  },
  {
    key: "factorio",
    name: "Factorio",
    image: "factoriotools/factorio:stable",
    ports: [{ container: 34197, proto: "udp" }],
    volumePaths: { data: "/factorio" },
    resources: {
      minimum: { cpu: 1024, memory: 512, description: "Small factory, 1-4 players" },
      recommended: { cpu: 2048, memory: 2048, description: "Medium factory, 4-10 players" },
      maximum: { cpu: 4096, memory: 8192, description: "Mega base, 10+ players" }
    },
    scaling: { playersPerGB: 5, playersPerCore: 10 }
  },
  {
    key: "ark",
    name: "ARK: Survival Evolved",
    image: "hermsi/ark-server:latest",
    ports: [
      { container: 7777, proto: "udp" },
      { container: 27015, proto: "udp" }
    ],
    volumePaths: { data: "/ark" },
    resources: {
      minimum: { cpu: 2048, memory: 6144, description: "Small map, 10 players" },
      recommended: { cpu: 4096, memory: 12288, description: "Full experience, 20-30 players" },
      maximum: { cpu: 6144, memory: 24576, description: "Large clusters, 50+ players" }
    },
    scaling: { playersPerGB: 2, playersPerCore: 10 }
  },
  {
    key: "palworld",
    name: "Palworld",
    image: "thijsvanloef/palworld-server-docker:latest",
    ports: [{ container: 8211, proto: "udp" }],
    envDefaults: {
      PUID: "1000",
      PGID: "1000",
      PORT: "8211",
      PLAYERS: "16",
      MULTITHREADING: "true"
    },
    volumePaths: { data: "/palworld" },
    resources: {
      minimum: { cpu: 4096, memory: 8192, description: "Basic server, 8-16 players" },
      recommended: { cpu: 6144, memory: 16384, description: "Smooth gameplay, 16-32 players" },
      maximum: { cpu: 8192, memory: 32768, description: "High performance, 32+ players" }
    },
    scaling: { playersPerGB: 2, playersPerCore: 8 }
  },
  {
    key: "rust",
    name: "Rust",
    image: "didstopia/rust-server:latest",
    ports: [
      { container: 28015, proto: "udp" },
      { container: 28016, proto: "tcp" }
    ],
    envDefaults: {
      RUST_SERVER_STARTUP_ARGUMENTS: "-batchmode -load +server.secure 1",
      RUST_SERVER_NAME: "SpinUp Rust Server"
    },
    volumePaths: { data: "/steamcmd/rust" },
    resources: {
      minimum: { cpu: 3072, memory: 4096, description: "Small map, 50 players" },
      recommended: { cpu: 4096, memory: 8192, description: "Standard map, 100-150 players" },
      maximum: { cpu: 8192, memory: 16384, description: "Large map, 200+ players" }
    },
    scaling: { playersPerGB: 18, playersPerCore: 50 }
  },
  {
    key: "zomboid",
    name: "Project Zomboid",
    image: "wolveix/project-zomboid:latest",
    ports: [
      { container: 16261, proto: "udp" },
      { container: 16262, proto: "udp" }
    ],
    volumePaths: { data: "/server-data" },
    resources: {
      minimum: { cpu: 2048, memory: 2048, description: "Small server, 4-8 players" },
      recommended: { cpu: 3072, memory: 4096, description: "Medium server, 8-16 players" },
      maximum: { cpu: 4096, memory: 8192, description: "Large server, 16-32 players" }
    },
    scaling: { playersPerGB: 4, playersPerCore: 8 }
  },
  {
    key: "terraria",
    name: "Terraria (TShock)",
    image: "beardedio/terraria:latest",
    ports: [{ container: 7777, proto: "tcp" }],
    volumePaths: { data: "/config" },
    resources: {
      minimum: { cpu: 1024, memory: 512, description: "Basic server, 4-8 players" },
      recommended: { cpu: 1024, memory: 1024, description: "Smooth gameplay, 8-16 players" },
      maximum: { cpu: 2048, memory: 2048, description: "Large worlds, 16-32 players" }
    },
    scaling: { playersPerGB: 16, playersPerCore: 16 }
  },
  {
    key: "cs2",
    name: "Counter-Strike 2",
    image: "cm2network/cs2:latest",
    ports: [{ container: 27015, proto: "udp" }],
    envDefaults: {
      SRCDS_TOKEN: "0",
      CS2_SERVERNAME: "SpinUp CS2 Server"
    },
    volumePaths: { data: "/home/steam/cs2-dedicated" },
    resources: {
      minimum: { cpu: 2048, memory: 2048, description: "Small matches, 10 players" },
      recommended: { cpu: 3072, memory: 4096, description: "Standard matches, 20 players" },
      maximum: { cpu: 4096, memory: 8192, description: "Large servers, 32+ players" }
    },
    scaling: { playersPerGB: 5, playersPerCore: 10 }
  },
  {
    key: "satisfactory",
    name: "Satisfactory",
    image: "wolveix/satisfactory-server:latest",
    ports: [
      { container: 7777, proto: "udp" },
      { container: 15000, proto: "udp" },
      { container: 15777, proto: "udp" }
    ],
    volumePaths: { data: "/config" },
    resources: {
      minimum: { cpu: 3072, memory: 4096, description: "Small factory, 2-4 players" },
      recommended: { cpu: 4096, memory: 8192, description: "Medium factory, 4-8 players" },
      maximum: { cpu: 6144, memory: 16384, description: "Large factory, 8+ players" }
    },
    scaling: { playersPerGB: 1, playersPerCore: 2 }
  },
  {
    key: "tf2",
    name: "Team Fortress 2",
    image: "cm2network/tf2:latest",
    ports: [
      { container: 27015, proto: "udp" },
      { container: 27015, proto: "tcp" },
      { container: 27020, proto: "udp" }
    ],
    envDefaults: {
      SRCDS_TOKEN: "0"
    },
    volumePaths: { data: "/home/steam/tf2-dedicated" },
    resources: {
      minimum: { cpu: 2048, memory: 1024, description: "Small matches, 12 players" },
      recommended: { cpu: 2048, memory: 2048, description: "Standard matches, 24 players" },
      maximum: { cpu: 3072, memory: 4096, description: "Large servers, 32 players" }
    },
    scaling: { playersPerGB: 12, playersPerCore: 12 }
  },
  {
    key: "squad",
    name: "Squad",
    image: "cm2network/squad:latest",
    ports: [
      { container: 7787, proto: "udp" },
      { container: 7788, proto: "udp" },
      { container: 27165, proto: "udp" },
      { container: 27165, proto: "tcp" },
      { container: 21114, proto: "tcp" }
    ],
    volumePaths: { data: "/home/steam/squad-dedicated" },
    resources: {
      minimum: { cpu: 4096, memory: 8192, description: "Small matches, 40 players" },
      recommended: { cpu: 6144, memory: 12288, description: "Standard matches, 60-80 players" },
      maximum: { cpu: 8192, memory: 16384, description: "Large battles, 100 players" }
    },
    scaling: { playersPerGB: 6, playersPerCore: 20 }
  },
  {
    key: "mordhau",
    name: "Mordhau",
    image: "cm2network/mordhau:latest",
    ports: [
      { container: 7777, proto: "udp" },
      { container: 15000, proto: "udp" },
      { container: 27015, proto: "udp" }
    ],
    volumePaths: { data: "/home/steam/mordhau-dedicated" },
    resources: {
      minimum: { cpu: 2048, memory: 2048, description: "Small matches, 16 players" },
      recommended: { cpu: 3072, memory: 4096, description: "Standard battles, 32-48 players" },
      maximum: { cpu: 4096, memory: 8192, description: "Large battles, 64 players" }
    },
    scaling: { playersPerGB: 8, playersPerCore: 16 }
  },
  {
    key: "dst",
    name: "Don't Starve Together",
    image: "dstacademy/dontstarvetogether:latest",
    ports: [
      { container: 10999, proto: "udp" },
      { container: 27015, proto: "udp" }
    ],
    envDefaults: {
      SERVER_NAME: "SpinUp DST Server",
      SERVER_PASSWORD: "",
      MAX_PLAYERS: "6"
    },
    volumePaths: { data: "/data" },
    resources: {
      minimum: { cpu: 1024, memory: 512, description: "Basic server, 2-4 players" },
      recommended: { cpu: 1024, memory: 1024, description: "Optimal performance, 4-6 players" },
      maximum: { cpu: 2048, memory: 2048, description: "Modded servers, 6-8 players" }
    },
    scaling: { playersPerGB: 6, playersPerCore: 6 }
  },
  {
    key: "starbound",
    name: "Starbound",
    image: "didstopia/starbound-server:latest",
    ports: [
      { container: 21025, proto: "tcp" }
    ],
    volumePaths: { data: "/steamcmd/starbound" },
    resources: {
      minimum: { cpu: 1024, memory: 1024, description: "Small server, 4 players" },
      recommended: { cpu: 2048, memory: 2048, description: "Standard server, 8 players" },
      maximum: { cpu: 2048, memory: 4096, description: "Large server, 12+ players" }
    },
    scaling: { playersPerGB: 4, playersPerCore: 8 }
  },
  {
    key: "vrising",
    name: "V Rising",
    image: "didstopia/vrising-server:latest",
    ports: [
      { container: 9876, proto: "udp" },
      { container: 9876, proto: "tcp" },
      { container: 9877, proto: "udp" }
    ],
    envDefaults: {
      SERVER_NAME: "SpinUp V Rising",
      WORLD_NAME: "world1",
      GAME_SETTINGS_PRESET: "StandardPvP"
    },
    volumePaths: { data: "/data" },
    resources: {
      minimum: { cpu: 2048, memory: 4096, description: "Small castle, 10 players" },
      recommended: { cpu: 4096, memory: 8192, description: "Medium castle, 20-30 players" },
      maximum: { cpu: 6144, memory: 16384, description: "Large castle, 40 players" }
    },
    scaling: { playersPerGB: 3, playersPerCore: 10 }
  },
  {
    key: "custom",
    name: "Custom Server (Advanced)",
    image: "ubuntu:22.04",
    ports: [], // Dynamically configured
    envDefaults: {},
    volumePaths: { data: "/data" },
    resources: {
      minimum: { cpu: 1024, memory: 512, description: "Minimal resources" },
      recommended: { cpu: 2048, memory: 2048, description: "Standard allocation" },
      maximum: { cpu: 8192, memory: 16384, description: "Maximum resources" }
    },
    scaling: { playersPerGB: 1, playersPerCore: 1 }
  }
];

export function getGameByKey(key: string): GameImage | undefined {
  return GAMES.find(g => g.key === key);
}