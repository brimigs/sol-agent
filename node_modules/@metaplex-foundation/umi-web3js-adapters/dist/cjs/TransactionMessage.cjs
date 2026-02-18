'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var umi = require('@metaplex-foundation/umi');
var web3_js = require('@solana/web3.js');
var Instruction = require('./Instruction.cjs');
var PublicKey = require('./PublicKey.cjs');

function fromWeb3JsMessage(message) {
  return {
    version: message.version,
    header: message.header,
    accounts: message.staticAccountKeys.map(PublicKey.fromWeb3JsPublicKey),
    blockhash: message.recentBlockhash,
    instructions: message.compiledInstructions.map(instruction => ({
      programIndex: instruction.programIdIndex,
      accountIndexes: instruction.accountKeyIndexes,
      data: new Uint8Array(instruction.data)
    })),
    addressLookupTables: message.addressTableLookups.map(lookup => ({
      publicKey: PublicKey.fromWeb3JsPublicKey(lookup.accountKey),
      writableIndexes: lookup.writableIndexes,
      readonlyIndexes: lookup.readonlyIndexes
    }))
  };
}
function toWeb3JsMessage(message) {
  if (message.version === 'legacy') {
    return new web3_js.Message({
      header: message.header,
      accountKeys: message.accounts.map(PublicKey.toWeb3JsPublicKey),
      recentBlockhash: message.blockhash,
      instructions: message.instructions.map(instruction => ({
        programIdIndex: instruction.programIndex,
        accounts: instruction.accountIndexes,
        data: umi.base58.deserialize(instruction.data)[0]
      }))
    });
  }
  return new web3_js.MessageV0({
    header: message.header,
    staticAccountKeys: message.accounts.map(PublicKey.toWeb3JsPublicKey),
    recentBlockhash: message.blockhash,
    compiledInstructions: message.instructions.map(instruction => ({
      programIdIndex: instruction.programIndex,
      accountKeyIndexes: instruction.accountIndexes,
      data: instruction.data
    })),
    addressTableLookups: message.addressLookupTables.map(lookup => ({
      accountKey: PublicKey.toWeb3JsPublicKey(lookup.publicKey),
      writableIndexes: lookup.writableIndexes,
      readonlyIndexes: lookup.readonlyIndexes
    }))
  });
}
function toWeb3JsMessageFromInput(input) {
  if (input.version === 'legacy') {
    return web3_js.Message.compile({
      payerKey: PublicKey.toWeb3JsPublicKey(input.payer),
      instructions: input.instructions.map(Instruction.toWeb3JsInstruction),
      recentBlockhash: input.blockhash
    });
  }
  return web3_js.MessageV0.compile({
    payerKey: PublicKey.toWeb3JsPublicKey(input.payer),
    instructions: input.instructions.map(Instruction.toWeb3JsInstruction),
    recentBlockhash: input.blockhash,
    addressLookupTableAccounts: input.addressLookupTables?.map(account => new web3_js.AddressLookupTableAccount({
      key: PublicKey.toWeb3JsPublicKey(account.publicKey),
      state: {
        addresses: account.addresses.map(PublicKey.toWeb3JsPublicKey),
        authority: undefined,
        deactivationSlot: BigInt(`0x${'ff'.repeat(8)}`),
        lastExtendedSlot: 0,
        lastExtendedSlotStartIndex: 0
      }
    }))
  });
}

exports.fromWeb3JsMessage = fromWeb3JsMessage;
exports.toWeb3JsMessage = toWeb3JsMessage;
exports.toWeb3JsMessageFromInput = toWeb3JsMessageFromInput;
//# sourceMappingURL=TransactionMessage.cjs.map
