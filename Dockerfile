FROM node:20-slim

# Install openssl and postgresql-client (includes pg_dump)
RUN apt-get update && apt-get install -y openssl postgresql-client && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm ci

# Copy the rest of the application files
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the NestJS API
RUN npm run api:build

# Expose NestJS API port
EXPOSE 3001

# Start the NestJS API server
CMD ["npm", "run", "api:start"]
