import { component } from "../classes/component.js";
import { h } from "../lib/hyperscript.js";

const initialState = {
  selectedBuild: "",
};

export default class extends component {
  constructor(actions, globalState) {
    super(initialState, undefined, actions, globalState);
  }

  async render() {
    return h(
      "div",
      {},
      h("div", { className: "backround" }),
      h(
        "a",
        {
          href: "https://oldcordapp.com",
          className: "logo-container",
        },
        h("img", {
          className: "logo-svg",
          src: "https://files.catbox.moe/66ix91.svg",
        })
      ),
      h(
        "div",
        {
          id: "selector-card",
          className: "card",
        },
        h("div"),
        h("div")
      ),
      h(
        "div",
        {
          id: "changelog-card",
          className: "card",
        },
        h("div")
      ),
      h("p", {}, "You're in main page!"),
      h(
        "button",
        {
          onclick: () => this.actions.changeView("settings"),
        },
        "Change view"
      )
    );
  }
}
