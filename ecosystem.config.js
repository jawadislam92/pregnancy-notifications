// pm2 process config.  Usage on the server:
//   cp .env.example .env   &&   nano .env      (set a password)
//   pm2 start ecosystem.config.js  &&  pm2 save  &&  pm2 startup
// server.js loads .env from its own folder, so no --env-file/cwd juggling needed.
module.exports = {
  apps: [{
    name: 'pregnancy-calendar',
    script: 'server.js',
    cwd: __dirname,
    instances: 1,
    autorestart: true,
    max_memory_restart: '600M'
  }]
};
