'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var web3_js = require('@solana/web3.js');
var buffer = require('buffer');
var PublicKey = require('./PublicKey.cjs');

function fromWeb3JsInstruction(instruction) {
  return {
    keys: instruction.keys.map(accountMeta => ({
      ...accountMeta,
      pubkey: PublicKey.fromWeb3JsPublicKey(accountMeta.pubkey)
    })),
    programId: PublicKey.fromWeb3JsPublicKey(instruction.programId),
    data: new Uint8Array(instruction.data)
  };
}
function toWeb3JsInstruction(instruction) {
  return new web3_js.TransactionInstruction({
    keys: instruction.keys.map(accountMeta => ({
      ...accountMeta,
      pubkey: PublicKey.toWeb3JsPublicKey(accountMeta.pubkey)
    })),
    programId: PublicKey.toWeb3JsPublicKey(instruction.programId),
    data: buffer.Buffer.from(instruction.data)
  });
}

exports.fromWeb3JsInstruction = fromWeb3JsInstruction;
exports.toWeb3JsInstruction = toWeb3JsInstruction;
//# sourceMappingURL=Instruction.cjs.map
