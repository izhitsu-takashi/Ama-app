// Google APIs用のブラウザPolyfill
// Node.js環境用のモジュールをブラウザ環境で使用するための設定

// process オブジェクトのPolyfill
(window as any).process = {
  env: {
    NODE_ENV: 'development'
  },
  version: 'v16.0.0',
  versions: {
    node: '16.0.0'
  },
  platform: 'browser',
  nextTick: (callback: Function) => setTimeout(callback, 0),
  cwd: () => '/',
  chdir: () => {},
  umask: () => 0,
  hrtime: () => [0, 0],
  uptime: () => 0,
  memoryUsage: () => ({
    rss: 0,
    heapTotal: 0,
    heapUsed: 0,
    external: 0,
    arrayBuffers: 0
  }),
  binding: () => ({}),
  dlopen: () => {},
  reallyExit: () => {},
  exit: () => {},
  kill: () => {},
  abort: () => {},
  on: () => {},
  addListener: () => {},
  once: () => {},
  removeListener: () => {},
  removeAllListeners: () => {},
  setMaxListeners: () => {},
  getMaxListeners: () => 0,
  listeners: () => [],
  emit: () => false,
  listenerCount: () => 0,
  prependListener: () => {},
  prependOnceListener: () => {},
  eventNames: () => [],
  title: 'browser',
  argv: [],
  execArgv: [],
  execPath: '/browser',
  pid: 1,
  ppid: 0,
  stdin: null,
  stdout: null,
  stderr: null,
  arch: 'x64',
  type: 'Browser'
};

// Buffer のPolyfill（必要に応じて）
if (typeof (window as any).Buffer === 'undefined') {
  (window as any).Buffer = {
    from: (data: any) => new Uint8Array(data),
    alloc: (size: number) => new Uint8Array(size),
    isBuffer: (obj: any) => obj instanceof Uint8Array
  };
}

// global オブジェクトの設定
if (typeof (window as any).global === 'undefined') {
  (window as any).global = window;
}

// console の拡張（必要に応じて）
if (typeof console.debug === 'undefined') {
  console.debug = console.log;
}

// URL のPolyfill（古いブラウザ用）
if (typeof URL === 'undefined') {
  (window as any).URL = class URL {
    constructor(url: string, base?: string) {
      const anchor = document.createElement('a');
      anchor.href = base ? new URL(url, base).href : url;
      this.href = anchor.href;
      this.protocol = anchor.protocol;
      this.host = anchor.host;
      this.hostname = anchor.hostname;
      this.port = anchor.port;
      this.pathname = anchor.pathname;
      this.search = anchor.search;
      this.hash = anchor.hash;
      this.origin = anchor.origin;
    }
    href: string;
    protocol: string;
    host: string;
    hostname: string;
    port: string;
    pathname: string;
    search: string;
    hash: string;
    origin: string;
  };
}

// fetch のPolyfill（古いブラウザ用）
if (typeof fetch === 'undefined') {
  (window as any).fetch = (url: string, options?: any) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(options?.method || 'GET', url);
      
      if (options?.headers) {
        Object.keys(options.headers).forEach(key => {
          xhr.setRequestHeader(key, options.headers[key]);
        });
      }
      
      xhr.onload = () => {
        resolve({
          ok: xhr.status >= 200 && xhr.status < 300,
          status: xhr.status,
          statusText: xhr.statusText,
          headers: new Headers(),
          text: () => Promise.resolve(xhr.responseText),
          json: () => Promise.resolve(JSON.parse(xhr.responseText)),
          blob: () => Promise.resolve(new Blob([xhr.response]))
        });
      };
      
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(options?.body);
    });
  };
}


