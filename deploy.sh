#!/bin/bash
git pull origin main
cd backend && npm install && pm2 restart jobblo-api --update-env
cd ../frontend && npm install && npm run build
sudo chown -R www-data:www-data /var/www/jobblo/frontend/dist
sudo systemctl restart nginx
echo "✅ Deployment Successful!"
