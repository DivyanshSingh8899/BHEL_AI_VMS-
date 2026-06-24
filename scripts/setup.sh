#!/usr/bin/env bash
# BHEL VMS — One-command development setup
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log() { echo -e "${BLUE}[BHEL-VMS]${NC} $1"; }
ok()  { echo -e "${GREEN}✓${NC} $1"; }
warn(){ echo -e "${YELLOW}⚠${NC} $1"; }
err() { echo -e "${RED}✗ $1${NC}"; exit 1; }

echo ""
echo "  ██████╗ ██╗  ██╗███████╗██╗"
echo "  ██╔══██╗██║  ██║██╔════╝██║"
echo "  ██████╔╝███████║█████╗  ██║"
echo "  ██╔══██╗██╔══██║██╔══╝  ██║"
echo "  ██████╔╝██║  ██║███████╗███████╗"
echo "  ╚═════╝ ╚═╝  ╚═╝╚══════╝╚══════╝"
echo "  Smart AI Visitor Management System"
echo ""

# Check prerequisites
log "Checking prerequisites..."
command -v docker &>/dev/null || err "Docker not found. Install Docker Desktop first."
command -v docker &>/dev/null && docker compose version &>/dev/null || err "Docker Compose not found."
ok "Docker & Docker Compose available"

# Backend environment
log "Setting up backend environment..."
if [ ! -f backend/.env ]; then
    cp backend/.env.example backend/.env
    # Generate secure keys
    SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(64))" 2>/dev/null || openssl rand -hex 48)
    JWT_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(64))" 2>/dev/null || openssl rand -hex 48)
    sed -i "s/change_this_to_a_random_64_char_string/$SECRET_KEY/" backend/.env
    sed -i "s/change_this_to_another_random_64_char_string/$JWT_KEY/" backend/.env
    ok "Backend .env created with generated keys"
else
    warn "backend/.env already exists — skipping"
fi

# Frontend environment
log "Setting up frontend environment..."
if [ ! -f frontend/.env.local ]; then
    cat > frontend/.env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:8000
EOF
    ok "Frontend .env.local created"
else
    warn "frontend/.env.local already exists — skipping"
fi

# SSL certificates for local development
log "Generating self-signed SSL certificates..."
mkdir -p nginx/ssl
if [ ! -f nginx/ssl/cert.pem ]; then
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout nginx/ssl/key.pem \
        -out nginx/ssl/cert.pem \
        -subj "/C=IN/ST=UP/L=Varanasi/O=BHEL/OU=IT/CN=bhel-vms.local" \
        2>/dev/null
    ok "SSL certificates generated"
fi

# Start services
log "Starting BHEL VMS services..."
docker compose pull
docker compose up -d --build

log "Waiting for services to be healthy..."
sleep 15

# Run database migrations
log "Running database migrations..."
docker compose exec -T backend alembic upgrade head || warn "Migration failed — tables may already exist"

ok "BHEL VMS is ready!"
echo ""
echo "  🌐 Frontend:    http://localhost:3000"
echo "  ⚡ Backend API: http://localhost:8000/api/docs"
echo "  🗄️  Database:   localhost:5432 (bhel_vms)"
echo ""
echo "  Default credentials:"
echo "  ┌─────────────┬──────────────────┬──────────────────┐"
echo "  │ Role        │ Username         │ Password         │"
echo "  ├─────────────┼──────────────────┼──────────────────┤"
echo "  │ Admin       │ admin            │ Admin@BHEL2026   │"
echo "  │ Security    │ security         │ Admin@BHEL2026   │"
echo "  │ Reception   │ reception        │ Admin@BHEL2026   │"
echo "  └─────────────┴──────────────────┴──────────────────┘"
echo ""
echo "  ⚠  Change default passwords immediately after first login!"
echo ""
