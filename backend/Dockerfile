# Production Dockerfile for Backend
FROM node:20-alpine

# Install build dependencies for native binaries (bcrypt, sqlite3)
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./

# Clean install production-only dependencies
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "index.js"]
