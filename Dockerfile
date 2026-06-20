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

# Render sets PORT at runtime (often 10000). EXPOSE is documentation only.
EXPOSE 10000

# Run migrations then bind 0.0.0.0 via main.ts (Render port scan requirement)
CMD ["npm", "run", "api:start:prod"]
