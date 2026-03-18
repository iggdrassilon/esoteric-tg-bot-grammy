# ---- BASE ----
FROM node:22-alpine AS base

RUN apk update && apk add --no-cache libc6-compat bash curl git

WORKDIR /app

FROM base AS builder

COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile

COPY . .

RUN yarn build

# ---- INSTALLER ----
FROM base AS installer

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules

COPY --from=builder /app/dist ./dist

COPY --from=builder /app/package.json ./package.json

# ---- RUNNER ----
FROM base AS runner

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 appuser
USER appuser

USER root
RUN apk add --no-cache curl gnupg

RUN curl -Ls https://cli.doppler.com/install.sh | sh

USER appuser

COPY --from=installer --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=installer --chown=appuser:nodejs /app/dist ./dist
COPY --from=installer --chown=appuser:nodejs /app/package.json ./package.json

WORKDIR /app

ENTRYPOINT ["doppler", "run", "--"]
CMD ["yarn", "start"]