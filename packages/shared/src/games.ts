export type PortSpec = {
  container: number;
  proto: "tcp" | "udp"
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
    volumePaths: { data: "/data" }
  },
  {
    key: "minecraft-bedrock",
    name: "Minecraft (Bedrock)",
    image: "itzg/minecraft-bedrock-server:latest",
    ports: [{ container: 19132, proto: "udp" }],
    envDefaults: { EULA: "TRUE" },
    volumePaths: { data: "/data" }
  },
  {
    key: "7dtd",
    name: "7 Days to Die",
    image: "didstopia/7dtd-server:latest",
    ports: [
      { container: 26900, proto: "udp" },
      { container: 26901, proto: "udp" }
    ],
    volumePaths: { data: "/steamcmd/7dtd" }
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
    volumePaths: { data: "/config" }
  },
  {
    key: "factorio",
    name: "Factorio",
    image: "factoriotools/factorio:stable",
    ports: [{ container: 34197, proto: "udp" }],
    volumePaths: { data: "/factorio" }
  },
  {
    key: "ark",
    name: "ARK: Survival Evolved",
    image: "hermsi/ark-server:latest",
    ports: [
      { container: 7777, proto: "udp" },
      { container: 27015, proto: "udp" }
    ],
    volumePaths: { data: "/ark" }
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
    volumePaths: { data: "/palworld" }
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
    volumePaths: { data: "/steamcmd/rust" }
  },
  {
    key: "zomboid",
    name: "Project Zomboid",
    image: "wolveix/project-zomboid:latest",
    ports: [
      { container: 16261, proto: "udp" },
      { container: 16262, proto: "udp" }
    ],
    volumePaths: { data: "/server-data" }
  },
  {
    key: "terraria",
    name: "Terraria (TShock)",
    image: "beardedio/terraria:latest",
    ports: [{ container: 7777, proto: "tcp" }],
    volumePaths: { data: "/config" }
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
    volumePaths: { data: "/home/steam/cs2-dedicated" }
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
    volumePaths: { data: "/config" }
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
    volumePaths: { data: "/home/steam/tf2-dedicated" }
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
    volumePaths: { data: "/home/steam/squad-dedicated" }
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
    volumePaths: { data: "/home/steam/mordhau-dedicated" }
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
    volumePaths: { data: "/data" }
  },
  {
    key: "starbound",
    name: "Starbound",
    image: "didstopia/starbound-server:latest",
    ports: [
      { container: 21025, proto: "tcp" }
    ],
    volumePaths: { data: "/steamcmd/starbound" }
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
    volumePaths: { data: "/data" }
  },
  {
    key: "custom",
    name: "Custom Server (Advanced)",
    image: "spinup/generic-server:latest",
    ports: [], // Dynamically configured
    envDefaults: {},
    volumePaths: { data: "/data" }
  }
];

export function getGameByKey(key: string): GameImage | undefined {
  return GAMES.find(g => g.key === key);
}