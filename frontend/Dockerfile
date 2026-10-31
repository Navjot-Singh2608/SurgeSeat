# Build stage: produce static files
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Serve stage: tiny NGINX serving the built SPA.
# In the full stack, the main NGINX load balancer can serve /usr/share/nginx/html directly instead.
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
