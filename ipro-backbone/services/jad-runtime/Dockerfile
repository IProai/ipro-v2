# Multi-stage build for JAD Runtime
FROM node:20 AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .

# Generate Prisma client
RUN npx prisma generate

# Final image
FROM node:20

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./

ENV PORT=3001
EXPOSE 3001

CMD ["npx", "ts-node", "src/index.ts"]
