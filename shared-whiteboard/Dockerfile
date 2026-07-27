FROM node:26-alpine@sha256:e88a35be04478413b7c71c455cd9865de9b9360e1f43456be5951032d7ac1a66
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --chown=node:node src/ ./src/
COPY --chown=node:node public/ ./public/
RUN mkdir -p data && chown node:node data

EXPOSE 3000
USER node
CMD ["node", "src/server.mjs"]
