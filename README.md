# Basilisk-api

## Description

Basilisk Coingecko api

## Running

### Dev

`npm run app-dev`

### Test

`npm run app-test`

### Production

`npm run app`

### Docker

`docker build -t basilisk-api .`
`docker run -p 3000:3000 -d basilisk-api`

## Framework

Built using:

- [Fastify](https://www.fastify.io/docs/latest/) for API framework;
- [PolkadotJS/api](https://polkadot.js.org/docs/api/) for communication with RPC;
- [Subsquid](https://docs.subsquid.io/) for chain indexer / processor;
