import { isPublicKey, publicKey } from '@metaplex-foundation/umi';
import { ProgramNotRecognizedError, ProgramErrorNotRecognizedError } from './errors.mjs';

function createDefaultProgramRepository(context, initialPrograms = [], initialBindings = {}) {
  const programs = [...initialPrograms];
  const bindings = {
    ...initialBindings
  };
  const has = (identifier, clusterFilter = 'current') => {
    const programs = all(clusterFilter);
    const resolvedIdentifier = resolveBinding(identifier);
    return isPublicKey(resolvedIdentifier) ? programs.some(p => p.publicKey === resolvedIdentifier) : programs.some(p => p.name === resolvedIdentifier);
  };
  const get = (identifier, clusterFilter = 'current') => {
    const cluster = resolveClusterFilter(clusterFilter);
    const programs = all(clusterFilter);
    const resolvedIdentifier = resolveBinding(identifier);
    const program = isPublicKey(resolvedIdentifier) ? programs.find(p => p.publicKey === resolvedIdentifier) : programs.find(p => p.name === resolvedIdentifier);
    if (!program) {
      throw new ProgramNotRecognizedError(resolvedIdentifier, cluster);
    }
    return program;
  };
  const getPublicKey = (identifier, fallback, clusterFilter) => {
    try {
      return get(identifier, clusterFilter).publicKey;
    } catch (error) {
      if (fallback === undefined) throw error;
      return publicKey(fallback);
    }
  };
  const all = (clusterFilter = 'current') => {
    const cluster = resolveClusterFilter(clusterFilter);
    return cluster === '*' ? programs : programs.filter(program => program.isOnCluster(cluster));
  };
  const add = (program, overrides = true) => {
    if (!overrides && has(program.publicKey, '*')) return;
    programs.unshift(program);
  };
  const bind = (abstract, concrete) => {
    bindings[abstract] = concrete;
    resolveBinding(abstract); // Ensures the binding is valid.
  };

  const unbind = abstract => {
    delete bindings[abstract];
  };
  const clone = () => createDefaultProgramRepository(context, programs, bindings);
  const resolveError = (error, transaction) => {
    // Ensure the error as logs.
    if (!Array.isArray(error.logs) || error.logs.length === 0) return null;
    const logs = error.logs.join('\n');

    // Parse the instruction number.
    const instructionRegex = /Error processing Instruction (\d+):/;
    const instruction = error.message.match(instructionRegex)?.[1] ?? null;

    // Parse the error code.
    const errorCodeRegex = /Custom program error: (0x[a-f0-9]+)/i;
    const errorCodeString = logs.match(errorCodeRegex)?.[1] ?? null;
    const errorCode = errorCodeString ? parseInt(errorCodeString, 16) : null;

    // Ensure we could find an instruction number and an error code.
    if (instruction === null || errorCode === null) return null;

    // Get the program ID from the instruction in the transaction.
    const instructionNumber = parseInt(instruction, 10);
    const programIndex = transaction.message.instructions?.[instructionNumber]?.programIndex ?? null;
    const programId = programIndex ? transaction.message.accounts[programIndex] : null;

    // Ensure we were able to find a program ID for the instruction.
    if (!programId) return null;

    // Find a registered program if any.
    let program;
    try {
      program = get(programId);
    } catch (_programNotFoundError) {
      return null;
    }

    // Finally, resolve the error.
    const resolvedError = program.getErrorFromCode(errorCode, error);
    return resolvedError ?? new ProgramErrorNotRecognizedError(program, error);
  };
  const resolveClusterFilter = clusterFilter => clusterFilter === 'current' ? context.rpc.getCluster() : clusterFilter;
  const resolveBinding = (identifier, stack = []) => {
    if (isPublicKey(identifier)) return identifier;
    if (bindings[identifier] === undefined) return identifier;
    const stackWithIdentifier = [...stack, identifier];
    if (stack.includes(identifier)) {
      throw new Error(`Circular binding detected: ${stackWithIdentifier.join(' -> ')}`);
    }
    return resolveBinding(bindings[identifier], stackWithIdentifier);
  };
  return {
    has,
    get,
    getPublicKey,
    all,
    add,
    bind,
    unbind,
    clone,
    resolveError
  };
}

export { createDefaultProgramRepository };
//# sourceMappingURL=createDefaultProgramRepository.mjs.map
