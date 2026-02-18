'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var umi = require('@metaplex-foundation/umi');

function createHttpDownloader(context) {
  const downloadOne = async (uri, options = {}) => {
    const response = await context.http.send(umi.request().get(uri).withAbortSignal(options.signal));
    return umi.createGenericFile(response.body, uri);
  };
  const download = async (uris, options = {}) => Promise.all(uris.map(uri => downloadOne(uri, options)));
  const downloadJson = async (uri, options = {}) => {
    const response = await context.http.send(umi.request().get(uri).withAbortSignal(options.signal));
    return response.data;
  };
  return {
    download,
    downloadJson
  };
}

exports.createHttpDownloader = createHttpDownloader;
//# sourceMappingURL=createHttpDownloader.cjs.map
