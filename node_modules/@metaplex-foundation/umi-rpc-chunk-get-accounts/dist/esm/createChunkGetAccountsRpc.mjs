import { chunk } from '@metaplex-foundation/umi';

const createChunkGetAccountsRpc = (rpc, chunkSize = 100) => ({
  ...rpc,
  getAccounts: async (publicKeys, options) => {
    const promises = chunk(publicKeys, chunkSize).map(chunk => rpc.getAccounts(chunk, options));
    const chunks = await Promise.all(promises);
    return chunks.flat();
  }
});

export { createChunkGetAccountsRpc };
//# sourceMappingURL=createChunkGetAccountsRpc.mjs.map
