import { RpcInterface } from '@metaplex-foundation/umi';
export interface ChunkGetAccountsRpcOptions {
    getAccountsChunkSize?: number;
}
export declare const createChunkGetAccountsRpc: (rpc: RpcInterface, chunkSize?: number) => RpcInterface;
