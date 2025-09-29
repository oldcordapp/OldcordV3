import { store } from "./state.js";

export class component {
  constructor(
    initialState,
    container = undefined,
    actions = undefined,
    globalState = undefined
  ) {
    this.rootElement = container;
    this.store = new store(initialState);
    this.globalStore = globalState;

    this.store.subscribe(() => this.render());
    this.actions = { ...this.actions, ...actions };

  }

  render() {}
}
