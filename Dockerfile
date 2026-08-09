# Root Dockerfile — builds the static site and serves it (works on Railway, Fly.io,
# Render, any Docker host). Zero-dependency build + server (no npm install needed).
FROM node:20-alpine
WORKDIR /app
COPY web/ ./web/
COPY data/ ./data/
# Build the static export into web/out
RUN cd web && node scripts/export-static.mjs
ENV PORT=8080
EXPOSE 8080
CMD ["node", "web/serve-prod.mjs"]
