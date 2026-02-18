'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var umi = require('@metaplex-foundation/umi');

class ProgramNotRecognizedError extends umi.SdkError {
  name = 'ProgramNotRecognizedError';
  constructor(identifier, cluster) {
    const isName = !umi.isPublicKey(identifier);
    const toString = isName ? identifier : identifier;
    const clusterString = cluster === '*' ? 'any' : `the [${cluster}]`;
    const message = `The provided program ${isName ? 'name' : 'address'} [${toString}] ` + `is not recognized in ${clusterString} cluster. ` + 'Did you forget to register this program? ' + 'If so, you may use "context.programs.add(myProgram)" to fix this.';
    super(message);
    this.identifier = identifier;
    this.cluster = cluster;
  }
}

/** @category Errors */
class ProgramErrorNotRecognizedError extends umi.ProgramError {
  name = 'ProgramErrorNotRecognizedError';
  constructor(program, cause) {
    const ofCode = cause.code ? ` of code [${cause.code}]` : '';
    const message = `The program [${program.name}] ` + `at address [${program.publicKey}] ` + `raised an error${ofCode} ` + `that is not recognized by the programs registered on the SDK. ` + `Please check the underlying program error below for more details.`;
    super(message, program, cause);
  }
}

exports.ProgramErrorNotRecognizedError = ProgramErrorNotRecognizedError;
exports.ProgramNotRecognizedError = ProgramNotRecognizedError;
//# sourceMappingURL=errors.cjs.map
