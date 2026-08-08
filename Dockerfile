FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json prisma.config.ts .env.example ./
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL="file:/data/meeting.db"
ENV APP_URL="http://localhost:3000"
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV DATABASE_URL="file:/data/meeting.db"
ENV SESSION_COOKIE_NAME="meeting_session"
ENV SESSION_TTL_DAYS="14"
ENV OFFICE_TIME_ZONE="Europe/Kyiv"
ENV OFFICE_OPEN_HOUR="9"
ENV OFFICE_CLOSE_HOUR="19"
ENV APP_URL="http://localhost:3000"
ENV EMAIL_VERIFICATION_TTL_MINUTES="30"
ENV NOTIFY_BEFORE_MINUTES="10"
COPY --from=builder /app ./
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npm run prisma:seed && npm start"]
