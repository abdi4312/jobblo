# Use official Node.js image as a base
FROM node:16

# Set working directory inside container
WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./

# Install backend dependencies
RUN npm install

# Copy the rest of the backend code
COPY backend/ .

# Expose backend port (if your app listens on 3000)
EXPOSE 3000

# Start the app
CMD ["npm", "start"]
