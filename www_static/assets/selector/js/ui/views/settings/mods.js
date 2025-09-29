import { component } from "../../classes/component.js";

const initialState = {};

export default class extends component {
  constructor(actions, globalState) {
    super(initialState, undefined, actions, globalState);
  }

  async render() {
    const container = document.createElement("div");

    const text = document.createElement("p");
    text.innerText = "You're in settings page!";

    const button = document.createElement("button");
    button.innerText = "Change view";

    button.addEventListener("click", () => {
      this.actions.changeView("main");
    });

    container.appendChild(text);
    container.appendChild(button);

    return container;
  }
}
