#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Complete local development setup for EAAF Automation
    
.DESCRIPTION
    Initializes database, starts embedding service, seeds data, and optionally starts dev server
    
.PARAMETER Clean
    Delete database, Python venv, and node_modules; rebuild from scratch
    
.PARAMETER SkipEmbeddings
    Skip embedding service startup (if already running)
    
.PARAMETER SkipSeed
    Skip data seeding (if already seeded)

.PARAMETER StartDev
    Auto-start Next.js development server after setup
    
.EXAMPLE
    .\setup-dev.ps1
    .\setup-dev.ps1 -Clean
    .\setup-dev.ps1 -SkipEmbeddings
    .\setup-dev.ps1 -StartDev
#>

param(
    [switch]$Clean,
    [switch]$SkipEmbeddings,
    [switch]$SkipSeed,
    [switch]$StartDev
)

$ErrorActionPreference = "Stop"
$WarningPreference = "Continue"

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "  EAAF Automation - Local Development Setup" -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan

# --- Clean mode: delete everything and start fresh -----------
if ($Clean) {
    Write-Host "`n[CLEAN] Resetting environment..." -ForegroundColor Yellow
    
    if (Test-Path "data/app.db") {
        Write-Host "  Deleting database (data/app.db)..." -ForegroundColor Cyan
        Remove-Item "data/app.db" -Force
        Write-Host "  OK Database deleted" -ForegroundColor Green
    }
    
    if (Test-Path "local-embedding-service\.venv") {
        Write-Host "  Deleting Python venv..." -ForegroundColor Cyan
        Remove-Item "local-embedding-service\.venv" -Recurse -Force
        Write-Host "  OK Python venv deleted" -ForegroundColor Green
    }
    
    if (Test-Path "node_modules") {
        Write-Host "  Deleting node_modules..." -ForegroundColor Cyan
        Remove-Item "node_modules" -Recurse -Force
        Write-Host "  OK node_modules deleted" -ForegroundColor Green
    }
    
    Write-Host "  OK Clean mode complete - proceeding with full rebuild`n" -ForegroundColor Green
}

# --- Check execution policy ---
Write-Host "`n[1/7] Checking PowerShell execution policy..." -ForegroundColor Yellow
$policy = Get-ExecutionPolicy -Scope CurrentUser
if ($policy -eq "Restricted") {
    Write-Host "  WARNING Execution policy is Restricted. Enabling for current user..." -ForegroundColor Yellow
    Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
    Write-Host "  OK Execution policy updated to RemoteSigned" -ForegroundColor Green
} else {
    Write-Host "  OK Execution policy OK ($policy)" -ForegroundColor Green
}

# --- Check prerequisites ---
Write-Host "`n[2/7] Checking prerequisites..." -ForegroundColor Yellow

$hasNode = $null -ne (Get-Command node -ErrorAction SilentlyContinue)
if (-not $hasNode) {
    Write-Host "  ERROR Node.js not found. Please install Node.js 18+ from https://nodejs.org" -ForegroundColor Red
    exit 1
}
$nodeVersion = node --version
Write-Host "  OK Node.js $nodeVersion" -ForegroundColor Green

$hasPython = $null -ne (Get-Command python -ErrorAction SilentlyContinue)
if (-not $hasPython) {
    Write-Host "  WARNING Python not found. Embedding service will not start (optional)." -ForegroundColor Yellow
} else {
    $pythonVersion = python --version
    Write-Host "  OK Python $pythonVersion" -ForegroundColor Green
}

# --- Set up Python venv for embedding service ---
Write-Host "`n[3/7] Setting up Python embedding service environment..." -ForegroundColor Yellow

$venvPython = "local-embedding-service\.venv\Scripts\python.exe"

if ($hasPython) {
    if (-not (Test-Path $venvPython)) {
        Write-Host "  Creating virtual environment..." -ForegroundColor Cyan
        python -m venv local-embedding-service\.venv
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  ERROR Failed to create virtual environment" -ForegroundColor Red
            $hasPython = $false
        } else {
            Write-Host "  OK Virtual environment created" -ForegroundColor Green
        }
    } else {
        Write-Host "  OK Virtual environment already exists" -ForegroundColor Green
    }

    if ($hasPython) {
        Write-Host "  Installing Python dependencies..." -ForegroundColor Cyan
        & $venvPython -m pip install -r local-embedding-service\requirements.txt --quiet
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  ERROR pip install failed" -ForegroundColor Red
            $hasPython = $false
        } else {
            Write-Host "  OK Python dependencies installed" -ForegroundColor Green
        }
    }
} else {
    Write-Host "  WARNING Python not available - skipping embedding environment setup" -ForegroundColor Yellow
    $venvPython = $null
}

# --- Install npm dependencies ---
Write-Host "`n[4/7] Installing npm dependencies..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR npm install failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "  OK Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "  OK Dependencies already installed" -ForegroundColor Green
}

# --- Initialize database ---
Write-Host "`n[5/7] Initializing database..." -ForegroundColor Yellow

# Check if database already exists
if (Test-Path "data/app.db") {
    Write-Host "  OK Database already exists at data/app.db" -ForegroundColor Green
} else {
    Write-Host "  Running: npm run db:init" -ForegroundColor Cyan
    npm run db:init
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR Database initialization failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "  OK Database initialized" -ForegroundColor Green
}

# --- Seed data ---
if (-not $SkipSeed) {
    Write-Host "`n[6/7] Seeding assessment data..." -ForegroundColor Yellow
    
    # Check if seed data file exists
    if (Test-Path "seed-data/assessments-seed.local.json") {
        Write-Host "  Running: npm run db:seed:assessments" -ForegroundColor Cyan
        npm run db:seed:assessments
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  WARNING Data seeding failed or no seed file found" -ForegroundColor Yellow
        } else {
            Write-Host "  OK Assessment data seeded" -ForegroundColor Green
        }
    } else {
        Write-Host "  WARNING seed-data/assessments-seed.local.json not found" -ForegroundColor Yellow
        Write-Host "    Request this file from your team lead" -ForegroundColor Yellow
    }
} else {
    Write-Host "`n[6/7] Skipping data seeding (-SkipSeed flag set)" -ForegroundColor Yellow
}

# --- Start embedding service ---
if (-not $SkipEmbeddings) {
    Write-Host "`n[7/7] Starting local embedding service..." -ForegroundColor Yellow

    if ($hasPython -and $venvPython -and (Test-Path $venvPython)) {

        # Kill any existing processes holding port 8001 before starting a new one
        $portPids = (netstat -ano | Select-String ":8001\s+\S+\s+LISTENING") |
            ForEach-Object { ($_ -split '\s+')[-1] } | Select-Object -Unique
        foreach ($pid in $portPids) {
            if ($pid -match '^\d+$') {
                Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                Write-Host "  Stopped old embedding service process (PID: $pid)" -ForegroundColor Gray
            }
        }

        Write-Host "  Starting embedding service on http://127.0.0.1:8001" -ForegroundColor Cyan

        $logFile = Join-Path $PWD "local-embedding-service\embedding-service.log"
        $embeddingProcess = Start-Process -FilePath $venvPython `
            -ArgumentList "local-embedding-service/app.py" `
            -NoNewWindow `
            -RedirectStandardOutput $logFile `
            -RedirectStandardError $logFile `
            -PassThru

        Write-Host "  Waiting for embedding service to be ready (log: local-embedding-service\embedding-service.log)..." -ForegroundColor Cyan

        $maxWait = 45
        $waited = 0
        $ready = $false
        while ($waited -lt $maxWait) {
            Start-Sleep -Seconds 2
            $waited += 2
            try {
                $resp = Invoke-WebRequest -Uri "http://127.0.0.1:8001/health" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
                if ($resp.StatusCode -eq 200) {
                    $ready = $true
                    break
                }
            } catch {
                # not ready yet
            }
            Write-Host "  ... waiting ($waited/$maxWait s)" -ForegroundColor Gray
        }

        if ($ready) {
            Write-Host "  OK Embedding service ready (PID: $($embeddingProcess.Id))" -ForegroundColor Green
            Write-Host "    To stop: Stop-Process -Id $($embeddingProcess.Id)" -ForegroundColor Gray
        } else {
            Write-Host "  WARNING Embedding service did not respond within $maxWait seconds" -ForegroundColor Yellow
            Write-Host "  Check log: local-embedding-service\embedding-service.log" -ForegroundColor Yellow
            Write-Host "  App will still start — run 'npm run embeddings:service' manually if needed" -ForegroundColor Gray
        }
    } else {
        Write-Host "  WARNING Python or venv not available - skipping embedding service" -ForegroundColor Yellow
    }
} else {
    Write-Host "`n[7/7] Skipping embedding service (-SkipEmbeddings flag set)" -ForegroundColor Yellow
}

# --- Ready to start dev server ---
Write-Host "`n====================================================================" -ForegroundColor Green
Write-Host "  Setup complete!" -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Green

if ($StartDev) {
    Write-Host "`n Starting development server..." -ForegroundColor Cyan
    Write-Host "   Open http://localhost:3000/eaaf-automation in your browser`n" -ForegroundColor Gray
    npm run dev
} else {
    Write-Host "`n Start the development server with:" -ForegroundColor Cyan
    Write-Host "   npm run dev" -ForegroundColor White
    Write-Host "`n   Open http://localhost:3000/eaaf-automation in your browser`n" -ForegroundColor Gray
}
