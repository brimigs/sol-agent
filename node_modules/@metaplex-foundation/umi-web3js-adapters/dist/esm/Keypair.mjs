import { publicKeyBytes } from '@metaplex-foundation/umi';
import { Keypair } from '@solana/web3.js';
import { fromWeb3JsPublicKey } from './PublicKey.mjs';

function fromWeb3JsKeypair(keypair) {
  return {
    publicKey: fromWeb3JsPublicKey(keypair.publicKey),
    secretKey: keypair.secretKey
  };
}
function toWeb3JsKeypair(keypair) {
  return new Keypair({
    publicKey: publicKeyBytes(keypair.publicKey),
    secretKey: keypair.secretKey
  });
}

export { fromWeb3JsKeypair, toWeb3JsKeypair };
//# sourceMappingURL=Keypair.mjs.map
