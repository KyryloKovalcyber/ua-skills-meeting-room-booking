FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL="file:/data/meeting.db"
RUN npx prisma generate && npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV DATABASE_URL="file:/data/meeting.db"
ENV SESSION_COOKIE_NAME="meeting_session"
ENV SESSION_TTL_DAYS="14"
ENV OFFICE_TIME_ZONE="Europe/Kyiv"
ENV OFFICE_OPEN_HOUR="9"
ENV OFFICE_CLOSE_HOUR="19"
COPY --from=builder /app ./
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npm run prisma:seed && npm start"]
