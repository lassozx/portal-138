#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Render sets NODE_ENV=production, but Prisma and Vite are required at build time.
npm --prefix server ci --include=dev
npm --prefix client ci --include=dev
(cd server && npx --no-install prisma generate)
npm --prefix client run build
npm --prefix server audit --omit=dev
npm --prefix client audit --omit=dev

# Free Render has no pre-deploy command or interactive shell. Run migrations
# explicitly from the owner's machine before publishing, then remove dev tools.
npm --prefix server prune --omit=dev
npm --prefix server audit --omit=dev
