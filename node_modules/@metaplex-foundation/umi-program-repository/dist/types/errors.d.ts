import { Cluster, Program, ProgramError, PublicKey, SdkError, UnderlyingProgramError } from '@metaplex-foundation/umi';
export declare class ProgramNotRecognizedError extends SdkError {
    readonly name: string;
    readonly identifier: string | PublicKey;
    readonly cluster: Cluster | '*';
    constructor(identifier: string | PublicKey, cluster: Cluster | '*');
}
/** @category Errors */
export declare class ProgramErrorNotRecognizedError extends ProgramError {
    readonly name: string;
    constructor(program: Program, cause: UnderlyingProgramError);
}
