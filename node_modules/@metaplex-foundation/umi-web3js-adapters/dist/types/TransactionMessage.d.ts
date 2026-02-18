import { TransactionInput, TransactionMessage } from '@metaplex-foundation/umi';
import { Message as Web3JsMessageLegacy, MessageV0 as Web3JsMessageV0 } from '@solana/web3.js';
export declare function fromWeb3JsMessage(message: Web3JsMessageLegacy | Web3JsMessageV0): TransactionMessage;
export declare function toWeb3JsMessage(message: TransactionMessage): Web3JsMessageLegacy | Web3JsMessageV0;
export declare function toWeb3JsMessageFromInput(input: TransactionInput): Web3JsMessageLegacy | Web3JsMessageV0;
