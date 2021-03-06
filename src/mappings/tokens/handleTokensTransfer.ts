import { Tokens } from "../../types";
import { toBasiliskFormattedAddress } from "../../utils/account";
import { transferParameters } from "../../utils/types";
import { updateMultiplePoolBalances } from "../../utils/pools";
import {
    EventContext,
    StoreContext,
    SubstrateEvent,
} from '@subsquid/hydra-common';

export const getTokensTransferParameters = (
    event: SubstrateEvent
): transferParameters => {
    const [assetId, from, to, balance] = new Tokens.TransferEvent(event).params;
    return {
        assetId: assetId.toBigInt(),
        from: toBasiliskFormattedAddress(from),
        to: toBasiliskFormattedAddress(to),
        balance: balance.toBigInt(),
    };
};

const handleTokensTransfer = async ({
    event,
    store,
}: EventContext & StoreContext) => {
    const transferParameters: transferParameters =
        getTokensTransferParameters(event);

    await updateMultiplePoolBalances(store, transferParameters);
};

export default handleTokensTransfer;
