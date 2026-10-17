# Start from an official Node.js image (version 20)
FROM node:20

# Make /app the folder we work inside the container
WORKDIR /app

# Copy the package files first (so Docker can cache installed packages)
COPY package.json package-lock.json ./

# Install dependencies. --include=optional makes sure sharp's Linux
# image binary is downloaded inside the container (not the Windows one).
RUN npm install --include=optional

# Copy the rest of the backend code into the container
COPY . .

# The server runs on port 5001 (see server.js)
EXPOSE 5001

# Command that starts the app
CMD ["node", "server.js"]
