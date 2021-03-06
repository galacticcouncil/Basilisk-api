import {
    EventContext,
    StoreContext,
    SubstrateEvent,
} from "@subsquid/hydra-common";
import { create } from "../../types/_registry";
import { toBasiliskFormattedAddress } from "../../utils/account";
import { saveLbpPoolSaleEnd } from "../../utils/pools";
import { u32 } from "@polkadot/types";
import { poolUpdatedParams1, poolUpdatedParameters } from "../../utils/types";

export const getPoolUpdatedParameters = (
    event: SubstrateEvent
): poolUpdatedParameters => {
    const poolAddress = create('AccountId32', event.params[0].value);
    const params1 = event.params[1].value as unknown as poolUpdatedParams1;
    const end: u32 = create('u32', params1.end);
    return {
        poolId: toBasiliskFormattedAddress(poolAddress),
        end: end.toBigInt(),
    };
};

/**
 * Whenever updatePool() is called on-chain for LBPs 
 * this function saves the sale start that is expressed
 * as relaychain block height.
 */
const handlePoolUpdated = async ({
    event,
    store,
}: EventContext & StoreContext): Promise<void> => {
    const poolUpdatedParameters: poolUpdatedParameters =
        getPoolUpdatedParameters(event);

    await saveLbpPoolSaleEnd(
        store,
        poolUpdatedParameters.poolId,
        poolUpdatedParameters.end
    );
};

export default handlePoolUpdated;
