#!/usr/bin/env bash
set -euo pipefail
# Build and produce a demo proof (groth16). Requires circom and snarkjs installed.
CIRCUIT=bandwidth_sum
BUILD_DIR=build
mkdir -p $BUILD_DIR

# compile
circom circuits/${CIRCUIT}.circom --r1cs --wasm --sym -o $BUILD_DIR

# NOTE: You need a ptau file. Download pot12_final.ptau or generate (large).
PTAU=pot12_final.ptau
if [ ! -f "$PTAU" ]; then
  echo "pot12_final.ptau not found. Please provide it in repo root."
  exit 1
fi

# setup
snarkjs groth16 setup $BUILD_DIR/${CIRCUIT}.r1cs $PTAU $BUILD_DIR/${CIRCUIT}_zkey

# export verification key
snarkjs zkey export verificationkey $BUILD_DIR/${CIRCUIT}_zkey $BUILD_DIR/verification_key.json

# Example input (8 intervals) - modify as needed
cat > $BUILD_DIR/input.json <<EOF
{
  "inputs": [100, 200, 150, 300, 250, 0, 0, 0]
}
EOF

# generate witness
node $BUILD_DIR/${CIRCUIT}_js/generate_witness.js $BUILD_DIR/${CIRCUIT}_js/${CIRCUIT}.wasm $BUILD_DIR/input.json $BUILD_DIR/witness.wtns

# prove
snarkjs groth16 prove $BUILD_DIR/${CIRCUIT}_zkey $BUILD_DIR/witness.wtns $BUILD_DIR/proof.json $BUILD_DIR/public.json

# verify (locally)
snarkjs groth16 verify $BUILD_DIR/verification_key.json $BUILD_DIR/public.json $BUILD_DIR/proof.json

echo "Proof and public json in $BUILD_DIR/"

