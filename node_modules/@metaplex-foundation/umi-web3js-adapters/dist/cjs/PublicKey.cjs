'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var web3_js = require('@solana/web3.js');

function fromWeb3JsPublicKey(publicKey) {
  return publicKey.toBase58();
}
function toWeb3JsPublicKey(publicKey) {
  return new web3_js.PublicKey(publicKey);
}

exports.fromWeb3JsPublicKey = fromWeb3JsPublicKey;
exports.toWeb3JsPublicKey = toWeb3JsPublicKey;
//# sourceMappingURL=PublicKey.cjs.map
