# Start from an official Node.js image (version 20)
FROM node:20

# Make /app the folder we work inside the container
WORKDIR /app

# Copy the package files first (so Docker can cache installed packages)
COPY package.json package-lock.json ./

# Install the project dependencies
RUN npm install

# Copy the rest of the frontend code into the container
COPY . .

# Vite's dev server runs on port 5173
EXPOSE 5173

# Start the dev server. --host lets you open it from your browser
# (outside the container), not just from inside it.
CMD ["npm", "run", "dev", "--", "--host"]
