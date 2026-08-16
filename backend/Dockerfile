# ---- deps ----
FROM node:20-alpine AS deps
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npx prisma --version >/dev/null 2>&1 || true

# ---- build (generate prisma client) ----
FROM node:20-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY prisma ./prisma
RUN npx prisma generate
COPY src ./src

# ---- runtime ----
FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S athe && adduser -S athe -G athe
COPY --from=deps --chown=athe:athe /app/node_modules ./node_modules
COPY --from=build --chown=athe:athe /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=athe:athe /app/prisma ./prisma
COPY --from=build --chown=athe:athe /app/src ./src
COPY --chown=athe:athe package.json ./

USER athe
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -qO- http://localhost:4000/healthz || exit 1

CMD ["node", "src/index.js"]
