import { Context, Program, ProgramRepositoryInterface, PublicKey } from '@metaplex-foundation/umi';
export declare function createDefaultProgramRepository(context: Pick<Context, 'rpc'>, initialPrograms?: Program[], initialBindings?: Record<string, string | PublicKey>): ProgramRepositoryInterface;
