import { compoment } from "../classes/compoment.js";

const initialState = {
  currentView: "",
};

export default class extends compoment {
  constructor(container, actions, globalState) {
    super(container, initialState, actions, globalState);
  }

  async render() {
    this.rootElement.innerHTML = "";

    const currentView = state.currentView;

    let viewComponent = null;

    try {
      const module = await import(`./${currentView}.js`);

      viewComponent = module.default;
    } catch (error) {
      console.error(`[Settings] Failed to load view: ${currentView}`, error);

      const fallbackModule = await import(`./main.js`);

      viewComponent = fallbackModule.default;
    }

    this.rootElement.appendChild(viewComponent(state, this));

    return container;
  }
}
