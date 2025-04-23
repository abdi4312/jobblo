# Use official Node.js image as a base
FROM node:16

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the app code
COPY . .

# Expose port (if needed)
EXPOSE 3000

# Command to run the app
CMD ["npm", "start"]
