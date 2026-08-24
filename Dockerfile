FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/src/lib/db.server.ts ./src/lib/db.server.ts
COPY --from=builder /app/src/lib/api/community.ts ./src/lib/api/community.ts

# Install tsx globally or locally to run seed script
RUN npm install -g tsx

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["npx", "vinxi", "start"]
