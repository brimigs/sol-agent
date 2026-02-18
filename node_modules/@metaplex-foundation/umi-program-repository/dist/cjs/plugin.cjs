'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var createDefaultProgramRepository = require('./createDefaultProgramRepository.cjs');

const defaultProgramRepository = () => ({
  install(umi) {
    umi.programs = createDefaultProgramRepository.createDefaultProgramRepository(umi);
  }
});

exports.defaultProgramRepository = defaultProgramRepository;
//# sourceMappingURL=plugin.cjs.map
