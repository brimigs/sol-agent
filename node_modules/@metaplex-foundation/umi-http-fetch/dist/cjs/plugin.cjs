'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var createFetchHttp = require('./createFetchHttp.cjs');

const fetchHttp = () => ({
  install(umi) {
    umi.http = createFetchHttp.createFetchHttp();
  }
});

exports.fetchHttp = fetchHttp;
//# sourceMappingURL=plugin.cjs.map
