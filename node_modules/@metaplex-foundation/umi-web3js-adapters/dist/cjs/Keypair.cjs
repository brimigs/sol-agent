'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var umi = require('@metaplex-foundation/umi');
var web3_js = require('@solana/web3.js');
var PublicKey = require('./PublicKey.cjs');

function fromWeb3JsKeypair(keypair) {
  return {
    publicKey: PublicKey.fromWeb3JsPublicKey(keypair.publicKey),
    secretKey: keypair.secretKey
  };
}
function toWeb3JsKeypair(keypair) {
  return new web3_js.Keypair({
    publicKey: umi.publicKeyBytes(keypair.publicKey),
    secretKey: keypair.secretKey
  });
}

exports.fromWeb3JsKeypair = fromWeb3JsKeypair;
exports.toWeb3JsKeypair = toWeb3JsKeypair;
//# sourceMappingURL=Keypair.cjs.map
