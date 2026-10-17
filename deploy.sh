#!/usr/bin/env bash
set -euo pipefail

echo "=========================================================="
echo "          Gurukul Production Deployment Script            "
echo "=========================================================="

# 1. Detect Host IP / Domain
DETECTED_IP=$(curl -s --max-time 3 ifconfig.me || hostname -I | awk '{print $1}' || echo "localhost")
echo "[+] Detected Server IP: $DETECTED_IP"

# 2. Check Bun installation
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

if ! command -v bun &> /dev/null; then
  echo "[!] Bun not found. Installing Bun..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$BUN_INSTALL/bin:$PATH"
fi
echo "[+] Using Bun version: $(bun --version)"

# 3. Check Docker and Docker Compose
if ! command -v docker &> /dev/null; then
  echo "[-] ERROR: Docker is not installed. Please install Docker first: https://docs.docker.com/engine/install/"
  exit 1
fi

if ! docker info &> /dev/null; then
  echo "[-] ERROR: Cannot connect to Docker daemon. Is Docker running? Try: sudo usermod -aG docker \$USER && newgrp docker"
  exit 1
fi
echo "[+] Docker is ready."

# 4. Setup .env configuration
if [ ! -f .env ]; then
  echo "[+] Creating .env from .env.example..."
  cp .env.example .env
  
  # Generate strong random auth secret
  RAND_SECRET=$(openssl rand -hex 24 2>/dev/null || date +%s%N | sha256sum | head -c 48)
  sed -i "s|BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=$RAND_SECRET|" .env
  sed -i "s|BETTER_AUTH_URL=.*|BETTER_AUTH_URL=http://$DETECTED_IP:3000|" .env
  sed -i "s|NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=http://$DETECTED_IP:3000|" .env
  sed -i "s|NEXT_PUBLIC_TELEMETRY_URL=.*|NEXT_PUBLIC_TELEMETRY_URL=ws://$DETECTED_IP:3001|" .env
  sed -i "s|NODE_ENV=.*|NODE_ENV=production|" .env
  echo "[+] Generated .env configured for http://$DETECTED_IP:3000"
else
  echo "[+] Existing .env file found."
fi

# 5. Start Infrastructure (Postgres & Redis)
echo "[+] Starting PostgreSQL and Redis containers..."
docker compose up -d --wait

# 6. Pre-pull Sandbox Execution Images (prevents student runtime timeout)
echo "[+] Pre-pulling language sandbox runtime images..."
docker pull node:22-bookworm-slim &
docker pull gcc:14-bookworm &
docker pull eclipse-temurin:21-jdk-jammy &
wait

# 7. Install Dependencies
echo "[+] Installing project dependencies..."
bun install

# 8. Run Migrations & Seed
echo "[+] Running Drizzle migrations..."
bun run db:migrate

if [ "${1:-}" == "--seed" ] || [ ! -f ".seeded" ]; then
  echo "[+] Seeding initial curriculum, demo users, and questions..."
  bun run db:seed
  touch .seeded
fi

# 9. Build Next.js Production Bundle
echo "[+] Building Next.js application..."
bun run build

# 10. Start or Restart Processes with PM2
if ! command -v pm2 &> /dev/null; then
  echo "[+] Installing PM2 process manager globally..."
  npm install -g pm2 || bun install -g pm2
fi

echo "[+] Starting / Reloading application services via PM2..."
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save

echo ""
echo "=========================================================="
echo "          Deployment Completed Successfully!              "
echo "=========================================================="
echo "Access the portal at:"
echo "  Web UI:    http://$DETECTED_IP:3000"
echo "  Telemetry: ws://$DETECTED_IP:3001"
echo ""
echo "Demo Accounts:"
echo "  Student:  ada@techsummit.example     / PortalDemo!2026"
echo "  Trainer:  trainer@techsummit.example / PortalDemo!2026"
echo "  Admin:    admin@techsummit.example   / PortalDemo!2026"
echo ""
echo "Useful Commands:"
echo "  pm2 status          - Check status of all 3 services"
echo "  pm2 logs            - Tail live logs"
echo "  pm2 restart all     - Restart all services"
echo "=========================================================="
