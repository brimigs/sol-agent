import { createFetchHttp } from './createFetchHttp.mjs';

const fetchHttp = () => ({
  install(umi) {
    umi.http = createFetchHttp();
  }
});

export { fetchHttp };
//# sourceMappingURL=plugin.mjs.map
