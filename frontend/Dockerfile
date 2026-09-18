# syntax=docker/dockerfile:1

# ---- build the static site ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY . .
# fresh clones have no .env (it's gitignored): use the public defaults
RUN [ -f .env ] || cp .env.example .env

# Vite bakes these in at build time; values from frontend/.env are used unless overridden
ARG VITE_SERVER_URL
ARG VITE_GOOGLE_CLIENT_ID
# (an empty build arg would still shadow frontend/.env, so drop it)
RUN [ -n "$VITE_SERVER_URL" ] || unset VITE_SERVER_URL; \
    [ -n "$VITE_GOOGLE_CLIENT_ID" ] || unset VITE_GOOGLE_CLIENT_ID; \
    npm run build

# ---- serve it ----
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
