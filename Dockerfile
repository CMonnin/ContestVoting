FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
COPY index.html landing.js ./
COPY images ./images
COPY fonts ./fonts
COPY scripts ./scripts
USER node
EXPOSE 3000
VOLUME /data
CMD ["node", "--disable-warning=ExperimentalWarning", "src/server.ts"]
