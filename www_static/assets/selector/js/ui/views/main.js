import { component } from "../classes/component.js";

const initialState = {
  selectedBuild: "",
};

export default class extends component {
  constructor(actions, globalState) {
    super(initialState, undefined, actions, globalState);
  }

  async render() {
    const container = document.createElement("div");

    const background = document.createElement("div");
    background.className = "backround";

    const logoContainer = document.createElement("a");
    const logoImg = document.createElement("img");

    logoContainer.href = "https://oldcordapp.com";
    logoContainer.className = "logo-container";

    logoImg.className = "logo-svg";
    logoImg.src = "https://files.catbox.moe/66ix91.svg";

    logoContainer.appendChild(logoImg);

    const selectorCard = document.createElement("div");
    selectorCard.id = "selector-card";
    selectorCard.className = "card";

    const changelogCard = document.createElement("div");
    changelogCard.id = "changelog-card";
    changelogCard.className = "card";

    const buildSelectorContainer = document.createElement("div");
    const patchesContainer = document.createElement("div");
    const changelogContainer = document.createElement("div");

    selectorCard.appendChild(buildSelectorContainer);
    selectorCard.appendChild(patchesContainer);

    changelogCard.appendChild(changelogContainer);

    const text = document.createElement("p");
    text.innerText = "You're in main page!";

    const button = document.createElement("button");
    button.innerText = "Change view";

    button.addEventListener("click", () => {
      this.actions.changeView("settings")
    })

    container.appendChild(selectorCard);
    container.appendChild(changelogCard);
    container.appendChild(text);
    container.appendChild(button);

    return container;
  }
}
