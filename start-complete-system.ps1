# Complete solVPN System Startup Script
# This script starts all services needed for the decentralized VPN

Write-Host "🚀 Starting solVPN Complete System..." -ForegroundColor Cyan
Write-Host ""

# Load environment variables
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match "^\s*([^#][^=]+)=(.*)$") {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
            Write-Host "✓ Loaded $name" -ForegroundColor Green
        }
    }
} else {
    Write-Host "⚠️  No .env file found, using defaults" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📋 Pre-flight checks..." -ForegroundColor Cyan

# Check if node_modules are installed
$services = @("services/attestor", "services/node-operator", "apps/web", "sdk")
foreach ($service in $services) {
    if (!(Test-Path "$service/node_modules")) {
        Write-Host "📦 Installing dependencies for $service..." -ForegroundColor Yellow
        Push-Location $service
        npm install --silent
        Pop-Location
    }
}

# Check if WireGuard keys exist
if (!(Test-Path "services/node-operator/wg-keys/node_public.key")) {
    Write-Host "🔑 Generating WireGuard keys..." -ForegroundColor Yellow
    Push-Location services/node-operator
    bash scripts/gen-wg-config.sh
    Pop-Location
}

Write-Host ""
Write-Host "🌐 Starting services..." -ForegroundColor Cyan
Write-Host ""

# Kill any existing node processes
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# Start Attestor Service
Write-Host "1️⃣  Starting Attestor Service (Port 8787)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\services\attestor'; npm run dev"

Start-Sleep -Seconds 2

# Start Node Operator WebSocket (VPN Traffic)
Write-Host "2️⃣  Starting Node Operator WebSocket (Port 3001)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\services\node-operator'; npm run dev"

Start-Sleep -Seconds 2

# Start Node Operator Agent (WireGuard Config Server)
Write-Host "3️⃣  Starting Node Operator Agent (Port 8788)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\services\node-operator'; npm run agent"

Start-Sleep -Seconds 2

# Start Web Frontend
Write-Host "4️⃣  Starting Web Frontend (Port 3000)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\apps\web'; npm run dev"

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "✅ All services started!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Service URLs:" -ForegroundColor Cyan
Write-Host "   • Frontend:        http://localhost:3000" -ForegroundColor White
Write-Host "   • VPN Demo:        http://localhost:3000/wg-demo" -ForegroundColor White
Write-Host "   • Attestor:        http://localhost:8787" -ForegroundColor White
Write-Host "   • Node Agent:      http://localhost:8788" -ForegroundColor White
Write-Host "   • VPN WebSocket:   ws://localhost:3001" -ForegroundColor White
Write-Host ""
Write-Host "🔑 WireGuard Keys:" -ForegroundColor Cyan
if (Test-Path "services/node-operator/wg-keys/node_public.key") {
    $wgKey = Get-Content "services/node-operator/wg-keys/node_public.key"
    Write-Host "   • Node Public Key: $wgKey" -ForegroundColor White
}
Write-Host ""
Write-Host "💡 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Open http://localhost:3000 in your browser" -ForegroundColor White
Write-Host "   2. Connect your Phantom wallet" -ForegroundColor White
Write-Host "   3. Register a node or start a VPN session" -ForegroundColor White
Write-Host "   4. Visit /wg-demo to download WireGuard config" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop this script (services will keep running)" -ForegroundColor Yellow
Write-Host ""

# Keep script running
while ($true) {
    Start-Sleep -Seconds 10
}

