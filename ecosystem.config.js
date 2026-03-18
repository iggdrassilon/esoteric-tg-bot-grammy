export const apps = [
  {
    name: "tg-bot",
    script: "doppler",
    args: "run -- yarn start",
    exec_mode: "fork",
    instances: "1",
    autorestart: true,
    watch: false,
    max_memory_restart: "700M",
  },
];

// pm2 startup systemd
