# Build with: docker build --build-arg APP_DIR=storefront --build-arg VITE_API_BASE_URL=https://api.example.com -t athe-storefront .
ARG APP_DIR=storefront
ARG VITE_API_BASE_URL

FROM node:20-alpine AS build
ARG APP_DIR
# Vite inlines VITE_-prefixed env vars into the client bundle at build time,
# so this has to be a real env var during `npm run build`, not just a build
# arg - otherwise import.meta.env.VITE_API_BASE_URL is undefined in the
# shipped JS and the app silently falls back to local sample data forever.
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
WORKDIR /app
COPY ${APP_DIR}/package.json ${APP_DIR}/package-lock.json* ./
RUN npm install
COPY ${APP_DIR}/ .
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:8080/healthz || exit 1
CMD ["nginx", "-g", "daemon off;"]
