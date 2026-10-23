// The in-browser router serialises requests, so one "current store" is exact (no interleaving).
exports.AsyncLocalStorage = class AsyncLocalStorage {
  constructor() { this.store = undefined; (globalThis.__auroraAls ??= []).push(this); }
  getStore() { return this.store; }
  run(store, fn) { this.store = store; return fn(); }
  enterWith(store) { this.store = store; }
};
