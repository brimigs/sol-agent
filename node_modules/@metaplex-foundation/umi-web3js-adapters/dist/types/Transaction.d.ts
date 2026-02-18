import { Transaction } from '@metaplex-foundation/umi';
import { Transaction as Web3JsLegacyTransaction, VersionedTransaction as Web3JsTransaction } from '@solana/web3.js';
export declare function fromWeb3JsTransaction(web3JsTransaction: Web3JsTransaction): Transaction;
export declare function toWeb3JsTransaction(transaction: Transaction): Web3JsTransaction;
export declare function fromWeb3JsLegacyTransaction(web3JsLegacyTransaction: Web3JsLegacyTransaction): Transaction;
export declare function toWeb3JsLegacyTransaction(transaction: Transaction): Web3JsLegacyTransaction;
