export default function main(state, app) {
  const container = document.createElement('div');

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

  container.appendChild(selectorCard);
  container.appendChild(changelogCard)

  return container
}
