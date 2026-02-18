'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var createDataViewSerializer = require('./createDataViewSerializer.cjs');

const dataViewSerializer = (options = {}) => ({
  install(umi) {
    umi.serializer = createDataViewSerializer.createDataViewSerializer(options);
  }
});

exports.dataViewSerializer = dataViewSerializer;
//# sourceMappingURL=plugin.cjs.map
