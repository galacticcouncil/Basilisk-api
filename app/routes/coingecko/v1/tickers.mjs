import path from "path";
import { dirname, gqlHost } from "../../../../variables.mjs";
import { newRpcClient } from "../../../../clients/rpc.mjs";
import { hexToString, u8aToHex } from "@polkadot/util";
import { decodeAddress } from "@polkadot/util-crypto";
import BigNumber from "bignumber.js";
import {
  TradeRouter,
  PoolService,
  PoolType,
  BalanceClient,
} from "@galacticcouncil/sdk";

const DAY = 24 * 1000 * 60 * 60;

const USDT_ASSET_ID = "14";

const gqlQuery = async (data) =>
  JSON.stringify(
    await (
      await fetch(gqlHost(), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })
    ).json()
  );

const getLatestPriceOf = async (base, target, poolId) => {
  const query = {
    query: `query LatestPrice($poolHex: String!) { events(where: {
    args_jsonContains: { pool: $poolHex },
    AND: {
      name_eq: "XYK.SellExecuted",
      OR: {
        name_eq: "XYK.BuyExecuted"
      }
    }
  }, limit:1, orderBy: block_timestamp_DESC) { name args } }`,
    variables: {
      poolHex: poolId,
    },
    operationName: "LatestPrice",
  };

  const args = JSON.parse(await gqlQuery(query))["data"]["events"][0]["args"];

  const isBuy = args.buyPrice != null;

  const assetInIsBase = Number(args.assetIn) == Number(base.id);

  const assetIn = assetInIsBase ? base : target;
  const assetOut = assetInIsBase ? target : base;

  const amount = new BigNumber(args.amount).div(
    new BigNumber(10).pow(assetIn.decimals)
  );
  const price = new BigNumber(args.buyPrice || args.salePrice).div(
    new BigNumber(10).pow(assetOut.decimals)
  );

  return assetInIsBase
    ? isBuy
      ? amount.div(price)
      : price.div(amount)
    : isBuy
    ? price.div(amount)
    : amount.div(price);
};

const getHighLow = async (base, target, poolId, date) => {
  const query = {
    query: `query HighLow($poolHex: String!, $after: DateTime!) { events(where: {
    args_jsonContains: { pool: $poolHex },
    block: { timestamp_gte: $after },
    AND: {
      name_eq: "XYK.SellExecuted",
      OR: {
        name_eq: "XYK.BuyExecuted"
      }
    }
  }, orderBy: block_timestamp_DESC) { name args } }`,
    variables: {
      after: date,
      poolHex: poolId,
    },
    operationName: "HighLow",
  };

  const buysAndSells = JSON.parse(await gqlQuery(query))["data"]["events"];

  const highLow = buysAndSells.reduce(
    (memo, item) => {
      const isBuy = item.args.buyPrice != null;

      const assetInIsBase = Number(item.args.assetIn) == Number(base.id);

      const assetIn = assetInIsBase ? base : target;
      const assetOut = assetInIsBase ? target : base;

      const amount = new BigNumber(item.args.amount).div(
        new BigNumber(10).pow(assetIn.decimals)
      );
      const price = new BigNumber(
        item.args.buyPrice || item.args.salePrice
      ).div(new BigNumber(10).pow(assetOut.decimals));

      const newPrice = assetInIsBase
        ? isBuy
          ? amount.div(price)
          : price.div(amount)
        : isBuy
        ? price.div(amount)
        : amount.div(price);

      if (memo["high"] === null) memo["high"] = newPrice;
      if (memo["low"] === null) memo["low"] = newPrice;

      if (memo["high"] && newPrice.gt(memo["high"])) memo["high"] = newPrice;
      if (memo["low"] && newPrice.lt(memo["low"])) memo["low"] = newPrice;

      return memo;
    },
    { high: null, low: null }
  );

  return highLow;
};

const getVolume = async (poolId, date) => {
  const query = {
    query: `query TradeVolume($poolHex: String!, $after: DateTime!) {
        events(
          where: {
            args_jsonContains: { pool: $poolHex }
            block: { timestamp_gte: $after }
            AND: {
              name_eq: "XYK.SellExecuted"
              OR: { name_eq: "XYK.BuyExecuted" }
            }
          }
        ) {
            name
            args
            block { timestamp }
          }
        }`,
    variables: {
      after: date,
      poolHex: poolId,
    },
    operationName: "TradeVolume",
  };

  const volume = JSON.parse(await gqlQuery(query))["data"]["events"];

  return volume.reduce((memo, item) => {
    const assetIn = item.args.assetIn.toString();
    const assetOut = item.args.assetOut.toString();

    if (memo[assetIn] == null) memo[assetIn] = new BigNumber(0);
    if (memo[assetOut] == null) memo[assetOut] = new BigNumber(0);

    if (item.name === "XYK.BuyExecuted") {
      memo[assetIn] = memo[assetIn].plus(new BigNumber(item.args.buyPrice));
      memo[assetOut] = memo[assetOut].plus(new BigNumber(item.args.amount));
    }

    if (item.name === "XYK.SellExecuted") {
      memo[assetIn] = memo[assetIn].plus(new BigNumber(item.args.amount));
      memo[assetOut] = memo[assetOut].plus(new BigNumber(item.args.salePrice));
    }

    return memo;
  }, {});
};

const getLiquidityInUsd = async (
  balanceClient,
  tradeRouter,
  poolId,
  baseAsset,
  targetAsset
) => {
  let liquidityBase = BigNumber(0);
  let liquidityTarget = BigNumber(0);

  const balanceBase = (
    await balanceClient.getBalance(poolId, baseAsset.id)
  ).dividedBy(new BigNumber(10).pow(baseAsset.decimals));
  const balanceTarget = (
    await balanceClient.getBalance(poolId, targetAsset.id)
  ).dividedBy(new BigNumber(10).pow(targetAsset.decimals));

  try {
    const resBase = await tradeRouter.getBestSpotPrice(
      baseAsset.id,
      USDT_ASSET_ID
    );

    const resTarget = await tradeRouter.getBestSpotPrice(
      targetAsset.id,
      USDT_ASSET_ID
    );

    if (resBase) {
      liquidityBase = balanceBase.times(
        resBase.amount.div(new BigNumber(10).pow(resBase.decimals))
      );
    }

    if (resTarget) {
      liquidityTarget = balanceTarget.times(
        resTarget.amount.div(new BigNumber(10).pow(resTarget.decimals))
      );
    }
  } catch (e) {
    console.log(e);
  }

  return liquidityBase.plus(liquidityTarget);
};

export default async (fastify, opts) => {
  fastify.route({
    url: "/tickers",
    method: ["GET"],
    schema: {
      description: "24h pricing and volume information for a given asset pair",
      tags: ["coingecko/v1"],
      response: {
        200: {
          description: "Success Response",
          type: "array",
          items: {
            type: "object",
            properties: {
              date: { type: "string" },
              ticker_id: { type: "string" },
              base_currency: { type: "string" },
              target_currency: { type: "string" },
              last_price: { type: "number" },
              base_volume: { type: "number" },
              target_volume: { type: "number" },
              pool_id: { type: "string" },
              liquidity_in_usd: { type: "number" },
              high: { type: "number" },
              low: { type: "number" },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const chain = await newRpcClient();

      const poolService = new PoolService(chain);
      const tradeRouter = new TradeRouter(poolService, {
        includeOnly: [PoolType.XYK],
      });

      const balanceClient = new BalanceClient(chain);

      const yesterday = new Date(Date.now() - DAY).toISOString();

      const pools = await poolService.getPools([PoolType.XYK]);

      const result = await Promise.all(
        pools.map(async ({ address, tokens }) => {
          const baseAsset = tokens[0];
          const targetAsset = tokens[1];

          const poolId = u8aToHex(decodeAddress(address));

          const latestPricePromise = getLatestPriceOf(
            baseAsset,
            targetAsset,
            poolId
          );

          const volumePromise = getVolume(poolId, yesterday);

          const liquidityInUsdPromise = getLiquidityInUsd(
            balanceClient,
            tradeRouter,
            poolId,
            baseAsset,
            targetAsset
          );

          const highLowPromise = getHighLow(
            baseAsset,
            targetAsset,
            poolId,
            yesterday
          );

          const [latestPrice, volume, liquidityInUsd, highLow] =
            await Promise.all([
              latestPricePromise,
              volumePromise,
              liquidityInUsdPromise,
              highLowPromise,
            ]);

          return {
            ticker_id: `${baseAsset.symbol}_${targetAsset.symbol}`,
            base_currency: baseAsset.symbol,
            target_currency: targetAsset.symbol,
            pool_id: address,
            last_price: Number(latestPrice),
            high: Number(highLow.high || 0),
            low: Number(highLow.low || 0),
            liquidity_in_usd: liquidityInUsd,
            base_volume:
              volume[baseAsset.id]?.div(
                new BigNumber(10).pow(baseAsset.decimals)
              ) || 0,
            target_volume:
              volume[targetAsset.id]?.div(
                new BigNumber(10).pow(targetAsset.decimals)
              ) || 0,
          };
        })
      );

      reply.send(result);
    },
  });
};
