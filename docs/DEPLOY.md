# Production Deployment Guide: AWS EC2 (t3a.micro)

This guide covers deploying the **Pokémon Gen 1 Battle Simulator** to an AWS EC2 `t3a.micro` instance (`linux/amd64`, Ubuntu 24.04 LTS, 1 GiB physical RAM) using Docker Compose and Caddy.

---

## 1. Architecture & Resource Allocation

### Host Resource Budget
A `t3a.micro` has 1 GiB physical memory. Because Linux system daemons and the Docker runtime require ~250–350 MiB, configuring a **2 GB swap file** on the host is **mandatory** to prevent Linux OOM killer thrashing.

| Component | Target Memory Allocation | Hard Container Limit (`mem_limit`) |
| :--- | :--- | :--- |
| **Ubuntu 24.04 OS & Daemons** | ~250–300 MiB | Host |
| **Docker Engine & Runtime** | ~100–150 MiB | Host |
| **Caddy Web Server (`caddy`)** | ~30–50 MiB | `80M` |
| **Node.js Battle Server (`server`)** | ~180–250 MiB (`--max-old-space-size=256`) | `450M` |
| **Total Host Memory Headroom** | **~600–750 MiB** physical + **2 GiB swap** | — |

---

## 2. Server Host Initial Setup (Ubuntu 24.04)

SSH into your fresh AWS EC2 instance:
```bash
ssh -i /path/to/key.pem ubuntu@<EC2_PUBLIC_IP>
```

### Step 2.1: Configure Mandatory 2 GB Swap File
```bash
# Verify no swap exists
sudo swapon --show

# Allocate 2 GB swapfile
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Persist swap across server reboots
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Verify swap is active (should show ~2.0G)
free -h
```

### Step 2.2: Configure AWS Security Group (Firewall)
> [!IMPORTANT]
> **Do NOT rely on `ufw` on the host.** Docker manipulates `iptables` directly and bypasses `ufw` rules. 
> Configure your **AWS EC2 Security Group** with the following inbound rules only:
> - **SSH**: Port `22` (restrict to your IP)
> - **HTTP**: Port `80` (`0.0.0.0/0`)
> - **HTTPS**: Port `443` (`0.0.0.0/0`)

No other ports (including `3000`) should be opened to the internet.

### Step 2.3: Install Docker CE & Docker Compose Plugin
```bash
# Add Docker official GPG key and repository
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker engine and compose
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Allow ubuntu user to execute docker without sudo
sudo usermod -aG docker $USER
newgrp docker
```

---

## 3. GHCR Authentication & Deployment Directory

### Step 3.1: Log in to GitHub Container Registry (GHCR)
Generate a GitHub Personal Access Token (classic) with `read:packages` scope (or fine-grained token with read access to packages), then log in on the EC2 host:
```bash
echo "<YOUR_GITHUB_TOKEN>" | docker login ghcr.io -u <YOUR_GITHUB_USERNAME> --password-stdin
```

### Step 3.2: Create Deployment Directory
You do **not** need to clone the repository or copy application code onto the server. The host requires only `docker-compose.yml` and `.env`:

```bash
mkdir -p ~/pokemon-battle
cd ~/pokemon-battle
```

Download or copy `docker-compose.yml` and `.env.example`:
```bash
curl -fsSL https://raw.githubusercontent.com/<OWNER>/<REPO>/main/docker-compose.yml -o docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/<OWNER>/<REPO>/main/.env.example -o .env
```

### Step 3.3: Self-Hosted Pokémon Sprites (Host Setup)

The production client serves Pokémon visual assets from a host-mounted directory (`./sprites:/srv/client/sprites:ro`), keeping image files completely out of Git and Docker images.

1. **Download assets locally** on your development machine (or an administrative workstation):
   ```bash
   node tools/download-sprites.mjs
   ```
   This downloads all 151 Gen 1 animated GIFs, transparent PNGs, and party icons into `apps/client/public/sprites/`.

2. **Upload assets to the EC2 server host**:
   ```bash
   # Create target sprites directory on the server
   ssh -i /path/to/key.pem ubuntu@<EC2_PUBLIC_IP> "mkdir -p ~/pokemon-battle/sprites"

   # Securely copy the sprites tree to the host
   scp -i /path/to/key.pem -r apps/client/public/sprites/* ubuntu@<EC2_PUBLIC_IP>:~/pokemon-battle/sprites/
   ```

3. **Verify expected directory layout on the host**:
   ```text
   ~/pokemon-battle/
   ├── docker-compose.yml
   ├── .env
   └── sprites/
       ├── animated/
       │   ├── 1.gif ... 151.gif
       │   └── back/
       │       ├── 1.gif ... 151.gif
       ├── transparent/
       │   ├── 1.png ... 151.png
       │   └── back/
       │       ├── 1.png ... 151.png
       └── icons/
           ├── 1.png ... 151.png
   ```

> [!IMPORTANT]
> **Host-Only Storage**: Pokémon sprites live exclusively on the host filesystem at `~/pokemon-battle/sprites/` and are mounted into Caddy as read-only (`./sprites:/srv/client/sprites:ro`). Sprites are **never** committed to Git and **never** bundled in Docker images.
> - **Server Rebuilds**: If the EC2 instance is ever terminated, recreated, or migrated, the sprites directory must be re-uploaded to the new host.
> - **Fallback Behavior**: If a sprite file is missing, Caddy will return a clean `404 Not Found` (without SPA `index.html` fallback), allowing the client to automatically cascade to the static transparent sprite or retro LCD badge placeholder without error.

---

## 4. Production Configuration (`.env`)

Edit `.env` using your preferred editor (`nano .env`):
```bash
# Your domain (DNS A record must point to this EC2 instance IP)
DOMAIN=battle.yourdomain.com

# Your GitHub username/org (lowercase)
GHCR_OWNER=yourgithubusername

# Set explicit commit SHA tags for both containers (NEVER use 'latest' in production)
SERVER_IMAGE_TAG=d75037f48b1114b0b1c97ef31e42a9b6c0e5a610
WEB_IMAGE_TAG=d75037f48b1114b0b1c97ef31e42a9b6c0e5a610

# Optional CORS Origin (leave blank for standard single-domain Caddy deployment)
CORS_ORIGIN=
```

### Note on Client (`Vite`) Environment Variables
Client variables (e.g. `VITE_ANIMATED_SPRITE_URL_TEMPLATE`, `VITE_STATIC_SPRITE_URL_TEMPLATE`, `VITE_PARTY_ICON_URL_TEMPLATE`, `VITE_SERVER_URL`) are embedded into the client bundle at **Docker build-time** in GitHub Actions.
To configure custom CDN sprite templates:
1. In GitHub, navigate to **Settings > Secrets and variables > Actions > Variables**.
2. Define repository variables such as:
   - `VITE_ANIMATED_SPRITE_URL_TEMPLATE`: `https://your-cdn.com/sprites/animated/{viewPath}{id}.gif`
   - `VITE_STATIC_SPRITE_URL_TEMPLATE`: `https://your-cdn.com/sprites/static/{viewPath}{id}.png`
   - `VITE_PARTY_ICON_URL_TEMPLATE`: `https://your-cdn.com/sprites/icons/{id}.png`
   - `VITE_SERVER_URL`: leave empty (defaults to same-origin `/`).

---

## 5. Starting the Application

```bash
# 1. Pull the pinned images from GHCR
docker compose pull

# 2. Start containers in detached mode
docker compose up -d

# 3. Verify container status and healthchecks
docker compose ps
```

You should see:
```text
NAME                     IMAGE                                                 STATUS                    PORTS
pokemon-battle-caddy-1   ghcr.io/username/pokemon-battle-web:<SHA>             Up (healthy)              0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
pokemon-battle-server-1  ghcr.io/username/pokemon-battle-server:<SHA>          Up (healthy)
```

### Verify Deployment
```bash
# Test healthcheck endpoint through Caddy
curl -i https://battle.yourdomain.com/healthz
```
Expected response:
```json
HTTP/2 200 
content-type: application/json; charset=utf-8
strict-transport-security: max-age=31536000; includeSubDomains; preload

{"status":"ok","uptime":14.2,"version":"<COMMIT_SHA>"}
```

---

## 6. Upgrades & Deployment Procedure

When a new commit is merged to `main`, GitHub Actions automatically builds, tests, smoke-tests, and pushes the new containers tagged with the commit SHA.

To deploy the new version:
1. SSH into the server and navigate to `~/pokemon-battle`.
2. Update the tags in `.env`:
   ```bash
   nano .env
   # Update SERVER_IMAGE_TAG and WEB_IMAGE_TAG to the new commit SHA
   ```
3. Pull the new images and restart containers:
   ```bash
   docker compose pull
   docker compose up -d
   ```
4. **Housekeeping (Disk Space Cleanup)**:
   The EC2 t3a.micro has a 20 GB disk. Prune dangling and unused old images after updating:
   ```bash
   docker image prune -f
   ```

---

## 7. Fast Rollback Procedure

> [!NOTE]
> Because game state is maintained in-memory on the authoritative server, a container restart or rollback will disconnect and conclude any currently active in-progress matches. The server sends a graceful shutdown notice before terminating.

If a regression is discovered in production, execute a **fast rollback** to any previously deployed commit SHA in seconds:

1. Locate the desired previous commit SHA from git history or GHCR packages.
2. In `~/pokemon-battle/.env`, update both tags:
   ```bash
   SERVER_IMAGE_TAG=<PREVIOUS_COMMIT_SHA>
   WEB_IMAGE_TAG=<PREVIOUS_COMMIT_SHA>
   ```
3. Re-launch the containers:
   ```bash
   docker compose up -d
   ```
4. Confirm health:
   ```bash
   curl -s https://battle.yourdomain.com/healthz
   ```

---

## 8. Operational Monitoring & Diagnostics

### View Live Logs
```bash
# Follow unified logs with log rotation limits
docker compose logs -f --tail=100

# View only battle server logs
docker compose logs -f server
```

### Inspect Resource Usage
```bash
docker stats --no-stream
```
Ensure `server` stays well below its `450M` limit and `caddy` stays under `80M`.

### Check Swap Usage
```bash
free -h
```
Ensure available memory + swap remains healthy (>500M free).
