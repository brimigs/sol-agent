'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var createHttpDownloader = require('./createHttpDownloader.cjs');

const httpDownloader = () => ({
  install(umi) {
    umi.downloader = createHttpDownloader.createHttpDownloader(umi);
  }
});

exports.httpDownloader = httpDownloader;
//# sourceMappingURL=plugin.cjs.map
