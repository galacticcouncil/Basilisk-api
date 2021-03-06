import { u32 } from '@polkadot/types';
import {
    EventContext,
    StoreContext,
    SubstrateEvent,
} from '@subsquid/hydra-common';
import { LBPPool } from '../../generated/model';
import { create } from '../../types/_registry';
import { toBasiliskFormattedAddress } from '../../utils/account';
import { createPool } from '../../utils/pools';
import { poolCreatedParameters, poolCreatedParams1 } from '../../utils/types';

export const getPoolCreatedParameters = (
    event: SubstrateEvent
): poolCreatedParameters => {
    const poolAddress = create('AccountId32', event.params[0].value);
    const params1 = event.params[1].value as unknown as poolCreatedParams1;
    const assetAId: u32 = create('u32', params1.assets[0]);
    const assetBId: u32 = create('u32', params1.assets[1]);

    return {
        poolId: toBasiliskFormattedAddress(poolAddress),
        assetAId: assetAId.toBigInt(),
        assetBId: assetBId.toBigInt(),
    };
};

const handleLbpPoolCreated = async ({
    event,
    store,
}: EventContext & StoreContext): Promise<void> => {
    const poolCreatedParameters: poolCreatedParameters =
        getPoolCreatedParameters(event);

    // create a new pool
    await createPool(store, LBPPool, poolCreatedParameters);
};

export default handleLbpPoolCreated;
