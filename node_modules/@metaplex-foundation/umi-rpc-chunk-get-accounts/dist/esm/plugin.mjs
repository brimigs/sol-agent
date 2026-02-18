import { createChunkGetAccountsRpc } from './createChunkGetAccountsRpc.mjs';

const chunkGetAccountsRpc = (chunkSize = 100) => ({
  install(umi) {
    umi.rpc = createChunkGetAccountsRpc(umi.rpc, chunkSize);
  }
});

export { chunkGetAccountsRpc };
//# sourceMappingURL=plugin.mjs.map
