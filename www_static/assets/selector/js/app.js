import { compoment } from "./ui/classes/component.js";
import main from "./ui/views/main.js";

const initialState = {
  overlayView: null,
};

export class App extends compoment {
  constructor(container) {
    super(container, initialState);

    this.viewInstances = {};
  }

  async render() {
    const state = this.store.getState();

    const overlayView = state.overlayView;

    if (!this.viewInstances.main) {
      console.log(`[Selector] Initializing main view...`);

      this.viewInstances.main = new main(this.rootElement);

      const viewElement = await this.viewInstances.main.render(
        this.state,
        this
      );

      this.rootElement.appendChild(viewElement);
    }

    if (overlayView) {
      const overlayContainer = document.createElement("div");

      overlayContainer.className("overlay-container");

      overlayContainer.innerHTML = "";

      let instance = this.viewInstances[overlayView];

      if (!instance) {
        const module = await import(`./ui/views/${overlayView}/main.js`);
        const component = module.default;

        console.log(`[Selector] Initializing ${overlayView} view...`);

        instance = new component(
          this.rootElement,
          {
            changeView: this.changeView.bind(this),
          },
          this.store
        );

        this.viewInstances[overlayView] = instance;
      }

      const element = instance.render(this.store);
      this.overlayContainer.appendChild(element);
    } else {
      this.rootElement
        .querySelectorAll("overlay-container")
        .forEach((element) => {
          element.remove();
        });
    }
  }

  async changeView(view) {
    switch (view) {
      case "main": {
        this.store.setState({ overlayView: null });
      }
      default: {
        this.store.setState({ overlayView: view });
      }
    }
  }
}
