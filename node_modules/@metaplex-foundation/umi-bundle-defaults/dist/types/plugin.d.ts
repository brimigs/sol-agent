import type { UmiPlugin } from '@metaplex-foundation/umi';
import { Web3JsRpcOptions } from '@metaplex-foundation/umi-rpc-web3js';
import { ChunkGetAccountsRpcOptions } from '@metaplex-foundation/umi-rpc-chunk-get-accounts';
import type { Connection as Web3JsConnection } from '@solana/web3.js';
export declare function defaultPlugins(endpoint: string, rpcOptions?: Web3JsRpcOptions & ChunkGetAccountsRpcOptions): UmiPlugin;
export declare function defaultPlugins(connection: Web3JsConnection, rpcOptions?: ChunkGetAccountsRpcOptions): UmiPlugin;
