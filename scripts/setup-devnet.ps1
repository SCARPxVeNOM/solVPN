param(
  [string]$MintAuthority = "",
  [string]$Cluster = "https://api.devnet.solana.com"
)

$ErrorActionPreference = "Stop"

Write-Host "Configuring Solana cluster..."
solana config set --url $Cluster | Out-Null

Write-Host "Airdropping 2 SOL to default keypair (if possible)..."
try { solana airdrop 2 | Out-Null } catch { Write-Host "Airdrop may have failed or rate-limited." }

Write-Host "Creating DVPN SPL mint (9 decimals)..."
$mintCreate = spl-token create-token --decimals 9
Write-Host $mintCreate
$mint = ($mintCreate | Select-String -Pattern "Creating token" -SimpleMatch:$false).ToString().Split(" ")[-1]
if (-not $mint) { throw "Failed to parse mint address" }

Write-Host "Creating ATA for mint owner..."
spl-token create-account $mint | Out-Null

Write-Host "Minting 1,000 DVPN to local ATA for testing..."
spl-token mint $mint 1000000000000 | Out-Null

Write-Host "Mint Address: $mint"
Write-Host "Note: After deploying program, set the PDA as mint authority if needed."


