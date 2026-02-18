import fetch from 'node-fetch';

function createFetchHttp() {
  return {
    send: async request => {
      const headers = request.headers ? Object.entries(request.headers).reduce((acc, [name, headers]) => ({
        ...acc,
        [name.toLowerCase()]: (Array.isArray(headers) ? headers.join(', ') : headers).toLowerCase()
      }), {}) : {};
      const isJsonRequest = headers['content-type']?.includes('application/json') ?? false;
      let body;
      if (isJsonRequest && request.data) {
        body = JSON.stringify(request.data);
      } else {
        body = request.data;
      }
      const requestInit = {
        method: request.method,
        body,
        headers,
        follow: request.maxRedirects,
        signal: request.signal,
        timeout: request.timeout
      };
      const response = await fetch(request.url, requestInit);
      const isJsonResponse = response.headers.get('content-type')?.includes('application/json') ?? false;
      const bodyAsText = await response.text();
      const bodyAsJson = isJsonResponse ? JSON.parse(bodyAsText) : undefined;
      return {
        data: bodyAsJson ?? bodyAsText,
        body: bodyAsText,
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      };
    }
  };
}

export { createFetchHttp };
//# sourceMappingURL=createFetchHttp.mjs.map
