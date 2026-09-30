FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server.js ./
COPY src ./src
COPY js ./js
COPY *.html *.png *.ico *.svg ./

USER node
EXPOSE 3000 3020/udp
CMD ["node", "server.js"]
