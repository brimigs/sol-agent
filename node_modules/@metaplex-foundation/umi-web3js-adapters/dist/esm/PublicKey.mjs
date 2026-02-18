import { PublicKey } from '@solana/web3.js';

function fromWeb3JsPublicKey(publicKey) {
  return publicKey.toBase58();
}
function toWeb3JsPublicKey(publicKey) {
  return new PublicKey(publicKey);
}

export { fromWeb3JsPublicKey, toWeb3JsPublicKey };
//# sourceMappingURL=PublicKey.mjs.map
