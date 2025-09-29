import { component } from "../../classes/component.js";
import { h } from "../../lib/hyperscript.js";

const initialState = {};

export default class extends component {
  constructor(actions, globalState) {
    super(initialState, undefined, actions, globalState);
  }

  async render() {
    return h(
      "div",
      {},
      h("p", {}, "You're in settings page!"),
      h(
        "button",
        {
          onclick: () => this.actions.changeView("main"),
        },
        "Change view"
      )
    );
  }
}
