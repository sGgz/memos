#!/bin/sh

set -e

# Change to repo root
cd "$(dirname "$0")/../"

cd web
pnpm build && pnpm release 
cd .. && ./scripts/build.sh
cd ./build && ./memos --addr "192.168.1.38" --port 12345 --data "..\run"

