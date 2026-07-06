# Deploying to a VPS

A small Ubuntu 22.04/24.04 box (1–2 GB RAM, ~$6–12/mo) is enough. Chromium (for
PDF export) is the only heavy dependency.

## 0. Before you start
- A VPS with SSH access (root or a sudo user).
- A domain name (optional but recommended) with an **A record** pointing at the VPS IP.

## 1. Install Node 22
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git
node -v      # should print v22.x
```

## 2. Get the app + dependencies
```bash
sudo mkdir -p /var/www && cd /var/www
git clone <YOUR_REPO_URL> pregnancy-calendar   # or upload the folder
cd pregnancy-calendar
npm ci
# Chromium + the system libraries it needs for headless rendering:
npx playwright install --with-deps chromium
```

## 3. Configure (set a password!)
```bash
cp .env.example .env
nano .env        # set STUDIO_PASSWORD to something strong; keep PORT=4010
```

## 4. Run it under pm2 (auto-restart + boot on reboot)
```bash
sudo npm i -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup      # run the command it prints, to start on reboot
pm2 logs pregnancy-calendar   # check it booted
```
The app is now on `http://<VPS_IP>:4010` (protected by the password you set).

## 5. Put it on your domain with HTTPS
```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/pregnancy-calendar
sudo nano /etc/nginx/sites-available/pregnancy-calendar     # set your domain
sudo ln -s /etc/nginx/sites-available/pregnancy-calendar /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d calendar.yourdomain.com            # free SSL
```
Optional hardening: `sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable`
(and close port 4010 to the outside so the app is only reachable through Nginx).

## Updating later
```bash
cd /var/www/pregnancy-calendar && git pull && npm ci && pm2 restart pregnancy-calendar
```

## Backups
Everything customer-related is one file: `data/customers.db`. Copy it somewhere safe
(e.g. a cron `scp`/`rsync`) to back up all records.

## Troubleshooting
- **PDF fails / blank**: rerun `npx playwright install --with-deps chromium` (missing libs).
- **502 in browser**: app isn’t running — `pm2 logs pregnancy-calendar`.
- **Fonts look off**: the server fetches Google Fonts at render time; ensure outbound
  HTTPS is allowed, or we can self-host the fonts for a fully offline box.
