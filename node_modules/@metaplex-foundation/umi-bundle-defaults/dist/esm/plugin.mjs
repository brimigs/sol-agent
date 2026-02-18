import { httpDownloader } from '@metaplex-foundation/umi-downloader-http';
import { web3JsEddsa } from '@metaplex-foundation/umi-eddsa-web3js';
import { fetchHttp } from '@metaplex-foundation/umi-http-fetch';
import { defaultProgramRepository } from '@metaplex-foundation/umi-program-repository';
import { web3JsRpc } from '@metaplex-foundation/umi-rpc-web3js';
import { chunkGetAccountsRpc } from '@metaplex-foundation/umi-rpc-chunk-get-accounts';
import { dataViewSerializer } from '@metaplex-foundation/umi-serializer-data-view';
import { web3JsTransactionFactory } from '@metaplex-foundation/umi-transaction-factory-web3js';

function defaultPlugins(endpointOrConnection, rpcOptions) {
  return {
    install(umi) {
      umi.use(dataViewSerializer());
      umi.use(defaultProgramRepository());
      umi.use(fetchHttp());
      umi.use(httpDownloader());
      umi.use(web3JsEddsa());
      umi.use(typeof endpointOrConnection === 'string' ? web3JsRpc(endpointOrConnection, rpcOptions) : web3JsRpc(endpointOrConnection));
      umi.use(chunkGetAccountsRpc(rpcOptions?.getAccountsChunkSize));
      umi.use(web3JsTransactionFactory());
    }
  };
}

export { defaultPlugins };
//# sourceMappingURL=plugin.mjs.map
