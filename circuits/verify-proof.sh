#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
snarkjs groth16 verify verification_key.json public.json proof.json >/dev/null && echo OK
