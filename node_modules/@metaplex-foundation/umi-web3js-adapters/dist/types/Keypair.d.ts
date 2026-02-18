import { Keypair } from '@metaplex-foundation/umi';
import { Keypair as Web3JsKeypair } from '@solana/web3.js';
export declare function fromWeb3JsKeypair(keypair: Web3JsKeypair): Keypair;
export declare function toWeb3JsKeypair(keypair: Keypair): Web3JsKeypair;
