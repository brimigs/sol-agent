import { Umi } from '@metaplex-foundation/umi';
import type { ChunkGetAccountsRpcOptions } from '@metaplex-foundation/umi-rpc-chunk-get-accounts';
import type { Web3JsRpcOptions } from '@metaplex-foundation/umi-rpc-web3js';
import type { Connection as Web3JsConnection } from '@solana/web3.js';
export declare function createUmi(endpoint: string, rpcOptions?: Web3JsRpcOptions & ChunkGetAccountsRpcOptions): Umi;
export declare function createUmi(connection: Web3JsConnection, rpcOptions?: ChunkGetAccountsRpcOptions): Umi;
export * from './plugin';
