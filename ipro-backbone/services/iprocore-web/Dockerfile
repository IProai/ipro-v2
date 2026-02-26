# Multi-stage build for IProCore Web (Vite)
FROM node:20 AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Final image: Nginx to serve static files
FROM nginx:stable

COPY --from=builder /app/dist /usr/share/nginx/html

# Default Nginx config is fine for SPA if we add a simple redirect for routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
