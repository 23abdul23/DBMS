FROM node:20-alpine

WORKDIR /app

COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
RUN npm ci

WORKDIR /app
COPY frontend ./frontend

WORKDIR /app/frontend

ENV API_HOST=localhost
ENV API_PORT=3000
ENV EXPO_NO_TELEMETRY=1
ENV CI=1

EXPOSE 8081

CMD ["npx", "expo", "start", "--web", "--host", "lan", "--port", "8081"]
