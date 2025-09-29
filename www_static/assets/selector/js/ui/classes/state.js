export class store {
  #state = {};
  #listeners = new Set();

  constructor(state) {
    this.#state = state;
  }

  getState() {
    return this.#state;
  }

  setState(state) {
    this.#state = { ...this.#state, ...state };
    this.#listeners.forEach((listener) => listener(state));
  }

  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
}
