import { SdkError, isPublicKey, ProgramError } from '@metaplex-foundation/umi';

class ProgramNotRecognizedError extends SdkError {
  name = 'ProgramNotRecognizedError';
  constructor(identifier, cluster) {
    const isName = !isPublicKey(identifier);
    const toString = isName ? identifier : identifier;
    const clusterString = cluster === '*' ? 'any' : `the [${cluster}]`;
    const message = `The provided program ${isName ? 'name' : 'address'} [${toString}] ` + `is not recognized in ${clusterString} cluster. ` + 'Did you forget to register this program? ' + 'If so, you may use "context.programs.add(myProgram)" to fix this.';
    super(message);
    this.identifier = identifier;
    this.cluster = cluster;
  }
}

/** @category Errors */
class ProgramErrorNotRecognizedError extends ProgramError {
  name = 'ProgramErrorNotRecognizedError';
  constructor(program, cause) {
    const ofCode = cause.code ? ` of code [${cause.code}]` : '';
    const message = `The program [${program.name}] ` + `at address [${program.publicKey}] ` + `raised an error${ofCode} ` + `that is not recognized by the programs registered on the SDK. ` + `Please check the underlying program error below for more details.`;
    super(message, program, cause);
  }
}

export { ProgramErrorNotRecognizedError, ProgramNotRecognizedError };
//# sourceMappingURL=errors.mjs.map
