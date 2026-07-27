FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2
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
