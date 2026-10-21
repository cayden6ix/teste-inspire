# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Estagio 1 - build
# ---------------------------------------------------------------------------
FROM node:24-alpine AS builder

WORKDIR /app

# Copia apenas os manifests primeiro para aproveitar o cache de camadas do Docker
# (as dependencias so sao reinstaladas quando o lockfile muda).
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci

COPY backend ./backend
RUN cd backend && npm run build && npm prune --omit=dev

# ---------------------------------------------------------------------------
# Estagio 2 - runtime
# ---------------------------------------------------------------------------
FROM node:24-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Usuario sem privilegios para executar a API.
RUN addgroup -S app && adduser -S app -G app

COPY --from=builder --chown=app:app /app/backend/dist ./dist
COPY --from=builder --chown=app:app /app/backend/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/backend/package.json ./package.json

USER app

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
