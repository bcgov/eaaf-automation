#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Complete local development setup for EAAF Automation
    
.DESCRIPTION
    Initializes database, starts embedding service, seeds data, and optionally starts dev server
    
.PARAMETER SkipEmbeddings
    Skip embedding service startup (if already running)
    
.PARAMETER SkipSeed
    Skip data seeding (if already seeded)

.PARAMETER StartDev
    Auto-start Next.js development server after setup
    
.EXAMPLE
    .\setup-dev.ps1
    .\setup-dev.ps1 -SkipEmbeddings
    .\setup-dev.ps1 -StartDev
#>

param(
    [switch]$SkipEmbeddings,
    [switch]$SkipSeed,
    [switch]$StartDev
)

$ErrorActionPreference = "Stop"
$WarningPreference = "Continue"

Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║         EAAF Automation — Local Development Setup             ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

# ─── Check execution policy ───────────────────────────────────────────────────
Write-Host "`n[1/7] Checking PowerShell execution policy..." -ForegroundColor Yellow
$policy = Get-ExecutionPolicy -Scope CurrentUser
if ($policy -eq "Restricted") {
    Write-Host "  ⚠ Execution policy is Restricted. Enabling for current user..." -ForegroundColor Yellow
    Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
    Write-Host "  ✓ Execution policy updated to RemoteSigned" -ForegroundColor Green
} else {
    Write-Host "  ✓ Execution policy OK ($policy)" -ForegroundColor Green
}

# ─── Check prerequisites ──────────────────────────────────────────────────────
Write-Host "`n[2/7] Checking prerequisites..." -ForegroundColor Yellow

$hasNode = $null -ne (Get-Command node -ErrorAction SilentlyContinue)
if (-not $hasNode) {
    Write-Host "  ✗ Node.js not found. Please install Node.js 18+ from https://nodejs.org" -ForegroundColor Red
    exit 1
}
$nodeVersion = node --version
Write-Host "  ✓ Node.js $nodeVersion" -ForegroundColor Green

$hasPython = $null -ne (Get-Command python -ErrorAction SilentlyContinue)
if (-not $hasPython) {
    Write-Host "  ⚠ Python not found. Embedding service will not start (optional)." -ForegroundColor Yellow
} else {
    $pythonVersion = python --version
    Write-Host "  ✓ Python $pythonVersion" -ForegroundColor Green
}

# ─── Set up Python venv for embedding service ────────────────────────────────
Write-Host "`n[3/7] Setting up Python embedding service environment..." -ForegroundColor Yellow

$venvPython = "local-embedding-service\.venv\Scripts\python.exe"

if ($hasPython) {
    if (-not (Test-Path $venvPython)) {
        Write-Host "  Creating virtual environment..." -ForegroundColor Cyan
        python -m venv local-embedding-service\.venv
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  ✗ Failed to create virtual environment" -ForegroundColor Red
            $hasPython = $false
        } else {
            Write-Host "  ✓ Virtual environment created" -ForegroundColor Green
        }
    } else {
        Write-Host "  ✓ Virtual environment already exists" -ForegroundColor Green
    }

    if ($hasPython) {
        Write-Host "  Installing Python dependencies (flask, sentence-transformers)..." -ForegroundColor Cyan
        & $venvPython -m pip install -r local-embedding-service\requirements.txt --quiet
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  ✗ pip install failed" -ForegroundColor Red
            $hasPython = $false
        } else {
            Write-Host "  ✓ Python dependencies installed" -ForegroundColor Green
        }
    }
} else {
    Write-Host "  ⚠ Python not available — skipping embedding environment setup" -ForegroundColor Yellow
    $venvPython = $null
}

# ─── Install npm dependencies ─────────────────────────────────────────────────
Write-Host "`n[4/7] Installing npm dependencies..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ✗ npm install failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "  ✓ Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "  ✓ Dependencies already installed" -ForegroundColor Green
}

# ─── Initialize database ──────────────────────────────────────────────────────
Write-Host "`n[5/7] Initializing database..." -ForegroundColor Yellow

# Check if database already exists
if (Test-Path "lib/db/app.db") {
    Write-Host "  ✓ Database already exists at lib/db/app.db" -ForegroundColor Green
} else {
    Write-Host "  Running: npm run db:init" -ForegroundColor Cyan
    npm run db:init
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ✗ Database initialization failed" -ForegroundColor Red
        Write-Host "  Please ensure seed-data/seed-questions.local.json exists" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "  ✓ Database initialized" -ForegroundColor Green
}

# ─── Seed data ────────────────────────────────────────────────────────────────
if (-not $SkipSeed) {
    Write-Host "`n[6/7] Seeding assessment data..." -ForegroundColor Yellow
    
    # Check if seed data file exists
    if (Test-Path "seed-data/assessments-seed.local.json") {
        Write-Host "  Running: npm run db:seed:assessments" -ForegroundColor Cyan
        npm run db:seed:assessments
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  ⚠ Data seeding failed or no seed file found" -ForegroundColor Yellow
        } else {
            Write-Host "  ✓ Assessment data seeded" -ForegroundColor Green
        }
    } else {
        Write-Host "  ⚠ seed-data/assessments-seed.local.json not found" -ForegroundColor Yellow
        Write-Host "    Request this file from your team lead" -ForegroundColor Yellow
    }
} else {
    Write-Host "`n[6/7] Skipping data seeding (-SkipSeed flag set)" -ForegroundColor Yellow
}

# ─── Start embedding service ──────────────────────────────────────────────────
if (-not $SkipEmbeddings) {
    Write-Host "`n[7/7] Starting local embedding service..." -ForegroundColor Yellow

    if ($hasPython -and $venvPython -and (Test-Path $venvPython)) {
        Write-Host "  Starting embedding service on http://127.0.0.1:8001" -ForegroundColor Cyan

        $embeddingProcess = Start-Process -FilePath $venvPython `
            -ArgumentList "local-embedding-service/app.py" `
            -NoNewWindow `
            -PassThru

        Write-Host "  ✓ Embedding service started (PID: $($embeddingProcess.Id))" -ForegroundColor Green
        Write-Host "    To stop: Stop-Process -Id $($embeddingProcess.Id)" -ForegroundColor Gray

        Start-Sleep -Seconds 2
    } else {
        Write-Host "  ⚠ Python or venv not available — skipping embedding service" -ForegroundColor Yellow
    }
} else {
    Write-Host "`n[7/7] Skipping embedding service (-SkipEmbeddings flag set)" -ForegroundColor Yellow
}

# ─── Ready to start dev server ────────────────────────────────────────────────
Write-Host "`n╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                     Setup complete! ✓                         ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Green

if ($StartDev) {
    Write-Host "`n🚀 Starting development server..." -ForegroundColor Cyan
    Write-Host "   Open http://localhost:3000/eaaf-automation in your browser`n" -ForegroundColor Gray
    npm run dev
} else {
    Write-Host "`n🚀 Start the development server with:" -ForegroundColor Cyan
    Write-Host "   npm run dev" -ForegroundColor White
    Write-Host "`n   Open http://localhost:3000/eaaf-automation in your browser`n" -ForegroundColor Gray
}
