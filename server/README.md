# OpsDesk sync server

Your own backend: one file, plain Node (v22.5+), a real SQLite database via Node's built-in driver. **No npm install. No dependencies. No third parties.**

## Run it

```
node server.js
```

That's the deployment. It prints the addresses it's reachable on; the database appears as `opsdesk.db` next to the script. Back that one file up and you've backed up every account.

## Point the app at it

In OpsDesk: **Settings → Account & sync** → enter the server address (e.g. `http://192.168.2.50:8787`) → **Connect** → **Create account**. Other devices: same address, **Sign in**.

> Browsers block an `https://` page from calling a plain-`http` server. So: use a **local copy** of the app (double-click `index.html`) with an http LAN server — or give the server HTTPS (Tailscale below) and the live site works too.

## Options (environment variables)

| Variable | Does |
|---|---|
| `OPSDESK_PORT` | Port (default 8787) |
| `OPSDESK_DATA` | Database file path |
| `OPSDESK_ALLOW_SIGNUP=0` | **Lock the server** once your accounts exist — sign-ups refused, sign-ins unaffected. Do this if the server is reachable beyond your LAN. |
| `OPSDESK_TLS_CERT` / `OPSDESK_TLS_KEY` | Serve HTTPS directly from cert/key files |

## HTTPS + phone access the easy way: Tailscale

Free, no port forwarding, works from anywhere, very homelab:

```
tailscale up
tailscale cert yourbox.your-tailnet.ts.net
set OPSDESK_TLS_CERT=yourbox.your-tailnet.ts.net.crt
set OPSDESK_TLS_KEY=yourbox.your-tailnet.ts.net.key
node server.js
```

Then every device on your tailnet (phone included) uses `https://yourbox.your-tailnet.ts.net:8787` — and because it's real HTTPS, the GitHub Pages live site can sync against it.

## Run it as a service on a Debian VM (svc01 says hi)

`/etc/systemd/system/opsdesk.service`:

```ini
[Unit]
Description=OpsDesk sync server
After=network.target

[Service]
ExecStart=/usr/bin/node /opt/opsdesk/server.js
Environment=OPSDESK_DATA=/var/lib/opsdesk/opsdesk.db
Environment=OPSDESK_ALLOW_SIGNUP=0
User=opsdesk
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```
sudo systemctl enable --now opsdesk
```

On Windows, Task Scheduler ("At startup", run `node C:\path\to\server.js`) does the same job.

## Security model

Passwords: scrypt with per-user salts, timing-safe comparison. Sessions: random 256-bit tokens stored hashed, 30-day sliding expiry, revoked on sign-out. Sign-in errors never reveal whether an email exists. Auth endpoints are rate-limited per IP. Every workspace read/write is scoped to the authenticated user — one row each, no exceptions.
