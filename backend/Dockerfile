# Use official Node.js image as a base
FROM node:20

# Set the working directory inside the container
WORKDIR /app

# Copy the package.json from the backend directory
COPY backend/package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code from backend/ to /app
COPY backend/ ./

# Expose port (adjust if necessary)
EXPOSE 3000

# Command to run the app (adjust as needed)
CMD ["npm", "start"]
