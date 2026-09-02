FROM node:20-bookworm-slim

WORKDIR /app

COPY backend/package*.json ./

RUN npm ci --omit=dev

COPY backend/ ./

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD ["node", "-e", "require('http').get('http://127.0.0.1:5001/api/test', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"]

CMD ["node", "server.js"]
