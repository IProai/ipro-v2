# Multi-stage build for IProCore API
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files if needed, but here we are in the service directory
COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .

# Generate Prisma client
RUN npx prisma generate

# Final image
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./

# Cloud Run expects PORT 8080 by default
ENV PORT=8080
EXPOSE 8080

CMD ["npx", "ts-node", "src/index.ts"]
