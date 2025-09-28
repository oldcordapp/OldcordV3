import { store } from "./ui/StateManager.js";

export class App {
  constructor(container) {
    this.rootElement = container;
    this.store = store;
    this.store.subscribe(() => this.render());
  }

  async render() {
    const state = this.store.getState();

    this.rootElement.innerHTML = '';

    const currentView = state.currentView;

    let viewCompoment = null;

    try {
      const module = await import(`./ui/views/${currentView}.js`);

      viewCompoment = module.default;
    } catch (error) {
      console.error(`[Selector] Failed to load view: ${currentView}`, error);

      const fallbackModule = await import(`./ui/views/main.js`);

      viewCompoment = fallbackModule.default;
    }

    this.rootElement.appendChild(viewCompoment(state, this));
  }

  changeView(view) {
    this.store.setState({ currentView: view });
  }
}
