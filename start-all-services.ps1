# Start all solVPN services
Write-Host "🚀 Starting solVPN Services..." -ForegroundColor Green

# Kill any existing Node processes
Write-Host "Cleaning up existing processes..." -ForegroundColor Yellow
Get-Process | Where-Object {$_.ProcessName -like "*node*"} | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Load environment variables
Write-Host "Loading environment variables from .env..." -ForegroundColor Yellow
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        $name = $matches[1]
        $value = $matches[2]
        [System.Environment]::SetEnvironmentVariable($name, $value, 'Process')
    }
}

# Start Attestor in new window
Write-Host "Starting Attestor service on port 8787..." -ForegroundColor Cyan
$attestorCmd = "cd '$PSScriptRoot\services\attestor'; `$env:PROGRAM_ID='8j3TUcbSuaq5BVNSf5GJhgucwrswH432sqJNxCoym8hB'; `$env:SOLANA_RPC='https://api.devnet.solana.com'; `$env:ATTESTOR_SECRET_KEY=(Get-Content '$PSScriptRoot\.env' | Select-String 'ATTESTOR_SECRET_KEY' | ForEach-Object {`$_ -replace 'ATTESTOR_SECRET_KEY=',''}); npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $attestorCmd

# Wait for attestor to start
Start-Sleep -Seconds 5

# Start Node Operator in new window
Write-Host "Starting Node Operator service..." -ForegroundColor Cyan
$nodeCmd = "cd '$PSScriptRoot\services\node-operator'; `$env:OPERATOR_PUBKEY='7hPVWvC9YRKmNf5HVm8HLiiLdnMuBTwJbzdZF2eQJhuh'; `$env:ATTESTOR_URL='http://localhost:8787'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $nodeCmd

# Wait a bit
Start-Sleep -Seconds 3

# Start Web Frontend in new window
Write-Host "Starting Web Frontend on port 3000..." -ForegroundColor Cyan
$webCmd = "cd '$PSScriptRoot\apps\web'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $webCmd

Write-Host ""
Write-Host "✅ All services started!" -ForegroundColor Green
Write-Host ""
Write-Host "📍 Service URLs:" -ForegroundColor Yellow
Write-Host "   🌐 Web Frontend:   http://localhost:3000" -ForegroundColor White
Write-Host "   🔒 Attestor:       http://localhost:8787" -ForegroundColor White
Write-Host "   🖥️  Node Operator:  (dynamic port)" -ForegroundColor White
Write-Host ""
Write-Host "⏳ Please wait 30-60 seconds for all services to fully start..." -ForegroundColor Gray
Write-Host "Press Ctrl+C in each window to stop services" -ForegroundColor Gray

