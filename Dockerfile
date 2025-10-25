FROM node:lts-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

ENV ENVIRONMENT=MAINNET
ENV USE_STREAMABLE_HTTP=true
ENV PORT=3000
ENV HOST=127.0.0.1

ENV PRIVATE_KEY=

ENV SOLANA_RPC_URL=
ENV SOLANA_RPC_URL_DEVNET=

COPY package*.json ./
COPY tsconfig.json ./

RUN pnpm install --ignore-scripts

COPY . .

RUN pnpm run build

EXPOSE 3000

CMD ["node", "./dist/index.js"]