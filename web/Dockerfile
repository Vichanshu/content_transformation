FROM node:20-bookworm-slim

WORKDIR /app
COPY package.json package-lock.json ./
# Next.js's transitive `fdir` dependency declares an optional picomatch peer.
# npm 10 validates that peer differently from newer npm releases, so keep the
# lockfile install deterministic while using npm's compatible peer resolver.
RUN npm ci --legacy-peer-deps --no-audit --no-fund
COPY . .
RUN npx prisma generate
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0"]
