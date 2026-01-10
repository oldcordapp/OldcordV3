function noop() {}

export function shim() {
  window.noop = noop;
}
