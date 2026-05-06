FROM node:20-alpine

WORKDIR /app

COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci

WORKDIR /app
COPY backend ./backend

WORKDIR /app/backend
RUN npm run prisma:generate

EXPOSE 5500

CMD ["sh", "-c", "npm run prisma:push && npm start"]
