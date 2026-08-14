# Build the static frontend, then serve it (and proxy /api) with Caddy.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Fetch the in-browser vision models; non-fatal so a build without network still works
# (the webcam analysis simply stays unavailable).
RUN npm run setup || echo "vision assets not fetched; webcam analysis will be unavailable"
RUN npm run build

FROM caddy:2-alpine
COPY --from=build /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
