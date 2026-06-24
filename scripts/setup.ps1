# BHEL VMS — Windows PowerShell Setup Script
# Run as: .\scripts\setup.ps1

Write-Host ""
Write-Host "  ██████╗ ██╗  ██╗███████╗██╗" -ForegroundColor Cyan
Write-Host "  ██╔══██╗██║  ██║██╔════╝██║" -ForegroundColor Cyan
Write-Host "  ██████╔╝███████║█████╗  ██║" -ForegroundColor Cyan
Write-Host "  ██╔══██╗██╔══██║██╔══╝  ██║" -ForegroundColor Cyan
Write-Host "  ██████╔╝██║  ██║███████╗███████╗" -ForegroundColor Cyan
Write-Host "  Smart AI Visitor Management System" -ForegroundColor Yellow
Write-Host ""

function Log($msg)  { Write-Host "[BHEL-VMS] $msg" -ForegroundColor Blue }
function Ok($msg)   { Write-Host "  ✓ $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "  ⚠ $msg" -ForegroundColor Yellow }
function Err($msg)  { Write-Host "  ✗ $msg" -ForegroundColor Red; exit 1 }

# Check Docker
Log "Checking prerequisites..."
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { Err "Docker not found. Install Docker Desktop." }
Ok "Docker available"

# Backend .env
Log "Setting up backend environment..."
if (-not (Test-Path "backend\.env")) {
    Copy-Item "backend\.env.example" "backend\.env"
    $secret = -join ((65..90 + 97..122 + 48..57) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
    $jwt    = -join ((65..90 + 97..122 + 48..57) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
    (Get-Content "backend\.env") -replace "change_this_to_a_random_64_char_string", $secret `
                                  -replace "change_this_to_another_random_64_char_string", $jwt |
        Set-Content "backend\.env"
    Ok "backend\.env created"
} else { Warn "backend\.env already exists" }

# Frontend .env.local
Log "Setting up frontend environment..."
if (-not (Test-Path "frontend\.env.local")) {
    @"
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:8000
"@ | Set-Content "frontend\.env.local"
    Ok "frontend\.env.local created"
} else { Warn "frontend\.env.local already exists" }

# Start services
Log "Starting Docker services..."
docker compose up -d --build

Log "Waiting for services to initialize (30s)..."
Start-Sleep -Seconds 30

# Run migrations
Log "Running database migrations..."
docker compose exec -T backend alembic upgrade head
if ($?) { Ok "Database migrations applied" } else { Warn "Migration may have failed — check logs" }

Write-Host ""
Write-Host "  BHEL VMS is ready!" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend:    http://localhost:3000" -ForegroundColor Cyan
Write-Host "  Backend API: http://localhost:8000/api/docs" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Default credentials  →  admin / Admin@BHEL2026" -ForegroundColor Yellow
Write-Host "  ⚠  Change passwords immediately after first login!" -ForegroundColor Red
Write-Host ""
