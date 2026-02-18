'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var createChunkGetAccountsRpc = require('./createChunkGetAccountsRpc.cjs');

const chunkGetAccountsRpc = (chunkSize = 100) => ({
  install(umi) {
    umi.rpc = createChunkGetAccountsRpc.createChunkGetAccountsRpc(umi.rpc, chunkSize);
  }
});

exports.chunkGetAccountsRpc = chunkGetAccountsRpc;
//# sourceMappingURL=plugin.cjs.map
