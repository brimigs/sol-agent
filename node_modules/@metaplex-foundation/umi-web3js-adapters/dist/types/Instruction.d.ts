import { Instruction } from '@metaplex-foundation/umi';
import { TransactionInstruction as Web3JsTransactionInstruction } from '@solana/web3.js';
export declare function fromWeb3JsInstruction(instruction: Web3JsTransactionInstruction): Instruction;
export declare function toWeb3JsInstruction(instruction: Instruction): Web3JsTransactionInstruction;
