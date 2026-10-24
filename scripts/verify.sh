#!/usr/bin/env bash
set -e

echo "=== 1/6: Server TypeScript Check ==="
(cd server && npx tsc --noEmit)

echo "=== 2/6: Server Unit Tests ==="
(cd server && npm test)

echo "=== 3/6: Frontend TypeScript Check ==="
(cd frontend && npx tsc -p tsconfig.app.json --noEmit)

echo "=== 4/6: Frontend Unit & Security Tests ==="
(cd frontend && npm test)

echo "=== 5/6: Frontend Production Build ==="
(cd frontend && npm run build)

echo "=== 6/6: Static Security & Quality Guards ==="
node scripts/guards.mjs

echo "🎉 VERIFICATION COMPLETED SUCCESSFULLY!"
