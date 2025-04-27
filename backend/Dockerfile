# Bruk en stabil Node.js LTS-versjond
FROM node:20

# Sett arbeidskatalogen
WORKDIR /app

# Kopier package.json og package-lock.json
COPY package*.json ./

# Installer kun produksjonsavhengigheter
RUN npm install

# Kopier resten av applikasjonen
COPY . .


# Start applikasjonen
CMD ["npm", "run", "start:prod"]
