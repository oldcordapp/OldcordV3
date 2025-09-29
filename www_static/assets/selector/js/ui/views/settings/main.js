import { component } from "../../classes/component.js";
import { h } from "../../lib/hyperscript.js";

const initialState = {
  currentView: "mods",
};

export default class extends component {
  constructor(actions, globalState) {
    super(initialState, undefined, actions, globalState);

    this.viewInstances = {};
  }

  async render() {
    const currentView = this.store.getState().currentView;

    let instance = this.viewInstances[currentView];

    if (!instance) {
      try {
        const module = await import(`./${currentView}.js`);
        const component = module.default;

        instance = new component(this.actions, this.globalStore);

        this.viewInstances[currentView] = instance;
      } catch (error) {
        console.error(`[Settings] Failed to load view: ${currentView}`, error);

        if (!this.viewInstances.mods) {
          const module = await import(`./mods.js`);
          const component = module.default;

          instance = new component(this.actions, this.globalStore);

          this.viewInstances.mods = instance;
        }
      }
    }

    return h("div", {}, await instance.render());
  }
}
