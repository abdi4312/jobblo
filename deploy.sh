#!/bin/bash
# Stop at the first failing step instead of printing "Successful" anyway.
set -euo pipefail
# Works from any folder: always run from the repository root (where this script lives).
cd "$(dirname "$(readlink -f "$0")")"

# Pull the branch this server is on (main, or a feature branch running live).
BRANCH="$(git branch --show-current)"
echo "→ Pulling $BRANCH"
git pull --ff-only origin "$BRANCH"

echo "→ Backend"
(cd backend && npm install && pm2 restart jobblo-api --update-env)

echo "→ Frontend"
(cd frontend && npm install && npm run build)
sudo chown -R www-data:www-data frontend/dist

# reload, not restart: open connections (chat, uploads) are not dropped.
sudo nginx -t && sudo systemctl reload nginx
echo "✅ Deployed $BRANCH @ $(git log -1 --format='%h %s')"
