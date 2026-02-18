import { createDefaultProgramRepository } from './createDefaultProgramRepository.mjs';

const defaultProgramRepository = () => ({
  install(umi) {
    umi.programs = createDefaultProgramRepository(umi);
  }
});

export { defaultProgramRepository };
//# sourceMappingURL=plugin.mjs.map
