import { createDataViewSerializer } from './createDataViewSerializer.mjs';

const dataViewSerializer = (options = {}) => ({
  install(umi) {
    umi.serializer = createDataViewSerializer(options);
  }
});

export { dataViewSerializer };
//# sourceMappingURL=plugin.mjs.map
