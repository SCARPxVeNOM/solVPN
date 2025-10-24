#!/usr/bin/env bash
set -euo pipefail
# gen-wg-config.sh
# Run once per node to create node keys and a single client config for demo.
# Requirements: wireguard-tools (wg, wg-quick) installed on host/container.

OUTDIR="./wg-keys"
mkdir -p "$OUTDIR"
umask 077

echo "[*] Generating node keypair..."
wg genkey | tee "$OUTDIR/node_private.key" | wg pubkey > "$OUTDIR/node_public.key"
echo "[*] Generating demo client keypair..."
wg genkey | tee "$OUTDIR/client_private.key" | wg pubkey > "$OUTDIR/client_public.key"

NODE_PUB=$(cat "$OUTDIR/node_public.key")
CLIENT_PRIV=$(cat "$OUTDIR/client_private.key")
CLIENT_PUB=$(cat "$OUTDIR/client_public.key")

# Replace <NODE_IP_OR_DNS> with your node's reachable IP/DNS (or keep placeholder)
NODE_ENDPOINT="${NODE_ENDPOINT:-<NODE_IP_OR_DNS>:51820}"
CLIENT_ADDR="${CLIENT_ADDR:-10.10.0.2/32}"

cat > "$OUTDIR/client-wg.conf" <<EOF
[Interface]
PrivateKey = ${CLIENT_PRIV}
Address = ${CLIENT_ADDR}
DNS = 1.1.1.1

[Peer]
PublicKey = ${NODE_PUB}
Endpoint = ${NODE_ENDPOINT}
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25
EOF

echo "[*] Written client config to $OUTDIR/client-wg.conf"
echo "[*] Node public key: $NODE_PUB"
echo "If behind NAT, ensure UDP 51820 is forwarded or use a relay/turn."

