#!/bin/bash
# Start the Node Operator relay service
cd /mnt/c/Users/aryan/Desktop/solVPN
export OPERATOR_PUBKEY=$(solana-keygen pubkey ~/.config/solana/id.json)
echo "Starting node operator for: $OPERATOR_PUBKEY"
npm run dev -w services/node-operator

