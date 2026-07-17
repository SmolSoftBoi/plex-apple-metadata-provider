FROM node:24.18.0-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:24.18.0-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

LABEL org.opencontainers.image.source="https://github.com/SmolSoftBoi/plex-apple-metadata-provider"
LABEL org.opencontainers.image.description="Unofficial Apple catalogue metadata provider scaffold for Plex"
LABEL org.opencontainers.image.licenses="MIT"

RUN groupadd --system provider && useradd --system --gid provider provider

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

RUN mkdir -p /app/data && chown -R provider:provider /app

USER provider
EXPOSE 3000
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

CMD ["node", "dist/server.js"]
