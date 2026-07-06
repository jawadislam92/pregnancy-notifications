// pm2 process config.  Usage on the server:
//   cp .env.example .env   &&   nano .env      (set a password)
//   pm2 start ecosystem.config.js  &&  pm2 save  &&  pm2 startup
module.exports = {
  apps: [{
    name: 'pregnancy-calendar',
    script: 'server.js',
    node_args: '--env-file=.env',   // loads PORT / STUDIO_PASSWORD from .env
    instances: 1,
    autorestart: true,
    max_memory_restart: '600M'
  }]
};
