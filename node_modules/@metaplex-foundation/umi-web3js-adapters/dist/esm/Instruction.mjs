import { TransactionInstruction } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { fromWeb3JsPublicKey, toWeb3JsPublicKey } from './PublicKey.mjs';

function fromWeb3JsInstruction(instruction) {
  return {
    keys: instruction.keys.map(accountMeta => ({
      ...accountMeta,
      pubkey: fromWeb3JsPublicKey(accountMeta.pubkey)
    })),
    programId: fromWeb3JsPublicKey(instruction.programId),
    data: new Uint8Array(instruction.data)
  };
}
function toWeb3JsInstruction(instruction) {
  return new TransactionInstruction({
    keys: instruction.keys.map(accountMeta => ({
      ...accountMeta,
      pubkey: toWeb3JsPublicKey(accountMeta.pubkey)
    })),
    programId: toWeb3JsPublicKey(instruction.programId),
    data: Buffer.from(instruction.data)
  });
}

export { fromWeb3JsInstruction, toWeb3JsInstruction };
//# sourceMappingURL=Instruction.mjs.map
