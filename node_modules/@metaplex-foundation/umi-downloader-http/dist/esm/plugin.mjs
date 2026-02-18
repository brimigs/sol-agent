import { createHttpDownloader } from './createHttpDownloader.mjs';

const httpDownloader = () => ({
  install(umi) {
    umi.downloader = createHttpDownloader(umi);
  }
});

export { httpDownloader };
//# sourceMappingURL=plugin.mjs.map
