'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var umiDownloaderHttp = require('@metaplex-foundation/umi-downloader-http');
var umiEddsaWeb3js = require('@metaplex-foundation/umi-eddsa-web3js');
var umiHttpFetch = require('@metaplex-foundation/umi-http-fetch');
var umiProgramRepository = require('@metaplex-foundation/umi-program-repository');
var umiRpcWeb3js = require('@metaplex-foundation/umi-rpc-web3js');
var umiRpcChunkGetAccounts = require('@metaplex-foundation/umi-rpc-chunk-get-accounts');
var umiSerializerDataView = require('@metaplex-foundation/umi-serializer-data-view');
var umiTransactionFactoryWeb3js = require('@metaplex-foundation/umi-transaction-factory-web3js');

function defaultPlugins(endpointOrConnection, rpcOptions) {
  return {
    install(umi) {
      umi.use(umiSerializerDataView.dataViewSerializer());
      umi.use(umiProgramRepository.defaultProgramRepository());
      umi.use(umiHttpFetch.fetchHttp());
      umi.use(umiDownloaderHttp.httpDownloader());
      umi.use(umiEddsaWeb3js.web3JsEddsa());
      umi.use(typeof endpointOrConnection === 'string' ? umiRpcWeb3js.web3JsRpc(endpointOrConnection, rpcOptions) : umiRpcWeb3js.web3JsRpc(endpointOrConnection));
      umi.use(umiRpcChunkGetAccounts.chunkGetAccountsRpc(rpcOptions?.getAccountsChunkSize));
      umi.use(umiTransactionFactoryWeb3js.web3JsTransactionFactory());
    }
  };
}

exports.defaultPlugins = defaultPlugins;
//# sourceMappingURL=plugin.cjs.map
