'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var umi = require('@metaplex-foundation/umi');

const createChunkGetAccountsRpc = (rpc, chunkSize = 100) => ({
  ...rpc,
  getAccounts: async (publicKeys, options) => {
    const promises = umi.chunk(publicKeys, chunkSize).map(chunk => rpc.getAccounts(chunk, options));
    const chunks = await Promise.all(promises);
    return chunks.flat();
  }
});

exports.createChunkGetAccountsRpc = createChunkGetAccountsRpc;
//# sourceMappingURL=createChunkGetAccountsRpc.cjs.map
