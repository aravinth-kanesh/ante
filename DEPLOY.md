# Deploying Ante to Oracle Cloud (free tier)

This walks through putting Ante live on a free Oracle Cloud VM. The whole app runs from
one `docker compose` command; most of this is one-time server setup.

You will need: an Oracle Cloud account, and (optional but recommended) a domain name so
the site gets automatic HTTPS.

## 1. Create the VM

In the Oracle Cloud console: **Compute -> Instances -> Create instance**.

- **Shape**: choose an **Ampere (Arm)** shape, e.g. `VM.Standard.A1.Flex` (this is in the
  Always Free tier; Ante is verified to run on Arm). 1-2 OCPUs and 6-12 GB RAM is plenty.
- **Image**: **Ubuntu 22.04**.
- **SSH keys**: upload or generate a key pair (you use this to log in).
- Create it, then note the instance's **public IP address**.

Open the web ports:

- **Networking -> Virtual cloud network -> your VCN -> the public subnet's security list**:
  add two **Ingress rules**, source `0.0.0.0/0`, destination ports **80** and **443** (TCP).

## 2. Connect and open the firewall on the VM

From your Mac:

```bash
ssh -i /path/to/your-key ubuntu@YOUR_PUBLIC_IP
```

Oracle's Ubuntu image also has a host firewall that blocks everything but SSH, so open
80 and 443 there too (this is the step everyone forgets):

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

## 3. Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker   # or log out and back in, so you can run docker without sudo
```

## 4. Get the code

```bash
git clone https://github.com/aravinth-kanesh/ante.git
cd ante
```

(The repo is private, so log in when prompted, or use a GitHub personal access token /
deploy key.)

## 5. Configure the environment

```bash
cp .env.example .env
nano .env      # fill in the values
```

Set at least:

- `JWT_SECRET` - a long random string. Generate one with `openssl rand -hex 32`.
- `DB_PASSWORD` - any strong password for the bundled PostgreSQL.
- `SITE_ADDRESS` and `SITE_ORIGIN` - your domain (e.g. `ante.example.com` and
  `https://ante.example.com`). Leave `SITE_ADDRESS=:80` if you only have an IP for now.
- The model: either `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL`, or `LLM_FAKE=1` to run
  without a key.
- **Logins**: production requires email verification, so **either** fill in the `SMTP_*`
  settings **or** set `REQUIRE_EMAIL_VERIFICATION=0`. Without one of these, new users
  cannot log in after signing up.

## 6. Point your domain at the VM

Add a DNS **A record** for your domain pointing at the VM's public IP. Once it resolves
and `SITE_ADDRESS` is your domain, Caddy obtains an HTTPS certificate automatically.

## 7. Launch

```bash
docker compose up -d --build
```

The first build takes a few minutes. Check it is healthy:

```bash
docker compose ps
curl -fsS http://localhost/api/health
```

Then open your domain (or `http://YOUR_PUBLIC_IP`) in a browser.

## Everyday operations

- **Logs**: `docker compose logs -f backend`
- **Update to the latest code**: `git pull && docker compose up -d --build`
- **Stop**: `docker compose down` (add `-v` to also wipe the database volume)
- **Back up the database**:
  `docker compose exec db pg_dump -U ante ante > backup.sql`

The database persists in a Docker volume (`db-data`). Answer recordings are only ever
stored temporarily and are deleted when a session ends, so nothing sensitive lingers.
