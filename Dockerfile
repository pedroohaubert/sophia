# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=20.12.1
FROM node:${NODE_VERSION}-slim as base

LABEL fly_launch_runtime="Next.js/Prisma"

# Next.js/Prisma app lives here
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Throw-away build stage to reduce size of final image
FROM base as build

# Forçar ambiente de desenvolvimento nesta etapa para instalar devDependencies
ENV NODE_ENV="development"
# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp openssl pkg-config python-is-python3

# Install node modules
COPY --link package-lock.json package.json ./
RUN pnpm install

# Generate Prisma Client
COPY --link prisma .
RUN npx prisma generate

# Definir NODE_ENV como produção antes do build
ENV NODE_ENV="production"
# Copy application code
COPY --link . .

# Build application
RUN pnpm build

# Remove development dependencies
RUN pnpm prune --prod

# Final stage for app image
FROM base

# Definir produção para a etapa final (runtime)
ENV NODE_ENV="production"
# Install packages needed for deployment
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y openssl && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

# Copy built application
COPY --from=build /app /app

# Copy .env file (add this part)
COPY .env /app/.env

# Start the server by default, this can be overwritten at runtime
EXPOSE 3000
CMD [ "pnpm", "start" ]
