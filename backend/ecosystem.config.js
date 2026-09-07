module.exports = {
  apps: [
    {
      name: "mymind-backend",
      script: "dist/server.js",
      node_args: "-r ./register.js",
      instances: "max",
      exec_mode: "cluster",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 8080,
      },
    },
  ],
};
