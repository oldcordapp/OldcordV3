import { component } from "./ui/classes/component.js";
import main from "./ui/views/main.js";

const initialState = {
  overlayView: null,
};

export class App extends component {
  constructor(container) {
    super(initialState, container);

    this.viewInstances = {};
  }

  async render() {
    const state = this.store.getState();

    const overlayView = state.overlayView;

    if (!this.viewInstances.main) {
      console.log(`[Selector] Initializing main view...`);

      this.viewInstances.main = new main(
        { changeView: this.changeView.bind(this) },
        this.store
      );

      const viewElement = await this.viewInstances.main.render();

      this.rootElement.appendChild(viewElement);
    }

    if (overlayView) {
      const overlayContainer = document.createElement("div");

      this.rootElement.appendChild(overlayContainer);

      overlayContainer.className = "overlay-container";

      overlayContainer.innerHTML = "";

      let instance = this.viewInstances[overlayView];

      if (!instance) {
        const module = await import(`./ui/views/${overlayView}/main.js`);
        const component = module.default;

        console.log(`[Selector] Initializing ${overlayView} view...`);

        instance = new component(
          {
            changeView: this.changeView.bind(this),
          },
          this.store
        );

        this.viewInstances[overlayView] = instance;
      }

      const element = await instance.render();

      overlayContainer.appendChild(element);
    } else {
      this.rootElement
        .querySelectorAll(".overlay-container")
        .forEach((element) => {
          element.remove();
        });
    }
  }

  changeView(view) {
    if (view == "main") {
      this.store.setState({ overlayView: null });
    } else {
      this.store.setState({ overlayView: view });
    }
  }
}
