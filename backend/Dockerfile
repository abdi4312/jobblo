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

# Second lock behind .dockerignore: refuse to produce an image that contains a
# private key (e.g. a Firebase service-account JSON). Firebase credentials are
# provided at runtime via GOOGLE_APPLICATION_CREDENTIALS pointing at a mounted file.
RUN if grep -rlIq --exclude-dir=node_modules -e '-----BEGIN [A-Z ]*PRIVATE KEY-----' . ; then \
      echo 'Refusing to build: a private key is in the build context (see .dockerignore).' >&2; \
      exit 1; \
    fi

# The server runs on port 5001 (see server.js)
EXPOSE 5001

# Command that starts the app
CMD ["node", "server.js"]
