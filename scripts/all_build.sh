#!/bin/sh

set -e

# Change to repo root
cd "$(dirname "$0")/../"

cd web
pnpm build && pnpm release 
cd .. && ./scripts/build.sh
cd ./build && ./memos --data "D:\work\code\momos\run"

