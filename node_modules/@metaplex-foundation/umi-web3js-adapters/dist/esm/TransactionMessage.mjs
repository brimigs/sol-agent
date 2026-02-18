import { base58 } from '@metaplex-foundation/umi';
import { Message, MessageV0, AddressLookupTableAccount } from '@solana/web3.js';
import { toWeb3JsInstruction } from './Instruction.mjs';
import { fromWeb3JsPublicKey, toWeb3JsPublicKey } from './PublicKey.mjs';

function fromWeb3JsMessage(message) {
  return {
    version: message.version,
    header: message.header,
    accounts: message.staticAccountKeys.map(fromWeb3JsPublicKey),
    blockhash: message.recentBlockhash,
    instructions: message.compiledInstructions.map(instruction => ({
      programIndex: instruction.programIdIndex,
      accountIndexes: instruction.accountKeyIndexes,
      data: new Uint8Array(instruction.data)
    })),
    addressLookupTables: message.addressTableLookups.map(lookup => ({
      publicKey: fromWeb3JsPublicKey(lookup.accountKey),
      writableIndexes: lookup.writableIndexes,
      readonlyIndexes: lookup.readonlyIndexes
    }))
  };
}
function toWeb3JsMessage(message) {
  if (message.version === 'legacy') {
    return new Message({
      header: message.header,
      accountKeys: message.accounts.map(toWeb3JsPublicKey),
      recentBlockhash: message.blockhash,
      instructions: message.instructions.map(instruction => ({
        programIdIndex: instruction.programIndex,
        accounts: instruction.accountIndexes,
        data: base58.deserialize(instruction.data)[0]
      }))
    });
  }
  return new MessageV0({
    header: message.header,
    staticAccountKeys: message.accounts.map(toWeb3JsPublicKey),
    recentBlockhash: message.blockhash,
    compiledInstructions: message.instructions.map(instruction => ({
      programIdIndex: instruction.programIndex,
      accountKeyIndexes: instruction.accountIndexes,
      data: instruction.data
    })),
    addressTableLookups: message.addressLookupTables.map(lookup => ({
      accountKey: toWeb3JsPublicKey(lookup.publicKey),
      writableIndexes: lookup.writableIndexes,
      readonlyIndexes: lookup.readonlyIndexes
    }))
  });
}
function toWeb3JsMessageFromInput(input) {
  if (input.version === 'legacy') {
    return Message.compile({
      payerKey: toWeb3JsPublicKey(input.payer),
      instructions: input.instructions.map(toWeb3JsInstruction),
      recentBlockhash: input.blockhash
    });
  }
  return MessageV0.compile({
    payerKey: toWeb3JsPublicKey(input.payer),
    instructions: input.instructions.map(toWeb3JsInstruction),
    recentBlockhash: input.blockhash,
    addressLookupTableAccounts: input.addressLookupTables?.map(account => new AddressLookupTableAccount({
      key: toWeb3JsPublicKey(account.publicKey),
      state: {
        addresses: account.addresses.map(toWeb3JsPublicKey),
        authority: undefined,
        deactivationSlot: BigInt(`0x${'ff'.repeat(8)}`),
        lastExtendedSlot: 0,
        lastExtendedSlotStartIndex: 0
      }
    }))
  });
}

export { fromWeb3JsMessage, toWeb3JsMessage, toWeb3JsMessageFromInput };
//# sourceMappingURL=TransactionMessage.mjs.map
