FROM node:24-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY frontend-next/package.json ./frontend-next/
COPY backend/package.json ./backend/
RUN npm ci

COPY frontend-next ./frontend-next
RUN npm run build:frontend

ENV NODE_ENV=production
EXPOSE 3001

CMD ["npm", "--workspace=frontend-next", "run", "start"]
