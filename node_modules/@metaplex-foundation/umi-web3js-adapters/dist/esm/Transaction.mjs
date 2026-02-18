import { base58 } from '@metaplex-foundation/umi';
import { VersionedTransaction, SIGNATURE_LENGTH_IN_BYTES, Transaction } from '@solana/web3.js';
import { fromWeb3JsMessage, toWeb3JsMessage } from './TransactionMessage.mjs';

function fromWeb3JsTransaction(web3JsTransaction) {
  return {
    message: fromWeb3JsMessage(web3JsTransaction.message),
    serializedMessage: web3JsTransaction.message.serialize(),
    signatures: web3JsTransaction.signatures
  };
}
function toWeb3JsTransaction(transaction) {
  return new VersionedTransaction(toWeb3JsMessage(transaction.message), transaction.signatures);
}
function fromWeb3JsLegacyTransaction(web3JsLegacyTransaction) {
  const web3JsMessage = web3JsLegacyTransaction.compileMessage();
  const web3JsLegacySignatures = web3JsLegacyTransaction.signatures.reduce((all, one) => {
    all[one.publicKey.toBase58()] = one.signature ? new Uint8Array(one.signature) : null;
    return all;
  }, {});
  const signatures = [];
  for (let i = 0; i < web3JsMessage.header.numRequiredSignatures; i += 1) {
    const pubkey = web3JsMessage.accountKeys[i].toBase58();
    const signature = web3JsLegacySignatures[pubkey] ?? null;
    signatures.push(signature ?? new Uint8Array(SIGNATURE_LENGTH_IN_BYTES));
  }
  return {
    message: fromWeb3JsMessage(web3JsMessage),
    serializedMessage: web3JsMessage.serialize(),
    signatures
  };
}
function toWeb3JsLegacyTransaction(transaction) {
  const web3JsTransaction = toWeb3JsTransaction({
    ...transaction,
    message: {
      ...transaction.message,
      version: 'legacy'
    }
  });
  return Transaction.populate(web3JsTransaction.message, web3JsTransaction.signatures.map(signature => base58.deserialize(signature)[0]));
}

export { fromWeb3JsLegacyTransaction, fromWeb3JsTransaction, toWeb3JsLegacyTransaction, toWeb3JsTransaction };
//# sourceMappingURL=Transaction.mjs.map
