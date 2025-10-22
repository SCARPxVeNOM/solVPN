$ErrorActionPreference = "Stop"

Write-Host "Building Anchor workspace..."
anchor build

Write-Host "Deploying program to Devnet..."
anchor deploy

Write-Host "Deployment finished. Program IDs in Anchor.toml should reflect deployed addresses."


