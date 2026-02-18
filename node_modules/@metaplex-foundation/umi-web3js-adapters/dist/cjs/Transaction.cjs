'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var umi = require('@metaplex-foundation/umi');
var web3_js = require('@solana/web3.js');
var TransactionMessage = require('./TransactionMessage.cjs');

function fromWeb3JsTransaction(web3JsTransaction) {
  return {
    message: TransactionMessage.fromWeb3JsMessage(web3JsTransaction.message),
    serializedMessage: web3JsTransaction.message.serialize(),
    signatures: web3JsTransaction.signatures
  };
}
function toWeb3JsTransaction(transaction) {
  return new web3_js.VersionedTransaction(TransactionMessage.toWeb3JsMessage(transaction.message), transaction.signatures);
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
    signatures.push(signature ?? new Uint8Array(web3_js.SIGNATURE_LENGTH_IN_BYTES));
  }
  return {
    message: TransactionMessage.fromWeb3JsMessage(web3JsMessage),
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
  return web3_js.Transaction.populate(web3JsTransaction.message, web3JsTransaction.signatures.map(signature => umi.base58.deserialize(signature)[0]));
}

exports.fromWeb3JsLegacyTransaction = fromWeb3JsLegacyTransaction;
exports.fromWeb3JsTransaction = fromWeb3JsTransaction;
exports.toWeb3JsLegacyTransaction = toWeb3JsLegacyTransaction;
exports.toWeb3JsTransaction = toWeb3JsTransaction;
//# sourceMappingURL=Transaction.cjs.map
