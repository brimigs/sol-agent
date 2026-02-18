import { PublicKey } from '@metaplex-foundation/umi';
import { PublicKey as Web3JsPublicKey } from '@solana/web3.js';
export declare function fromWeb3JsPublicKey(publicKey: Web3JsPublicKey): PublicKey;
export declare function toWeb3JsPublicKey(publicKey: PublicKey): Web3JsPublicKey;
