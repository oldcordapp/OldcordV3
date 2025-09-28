class StateManager {
  _state = {
    currentView: "main",
    selectedBuild: null,
  };
  _listeners = new Set();

  constructors

  getState() {
    return this._state;
  }

  setState(state) {
    this._state = { ...this._state, ...state };
    this._listeners.forEach((listener) => listener(state));
  }

  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }
}

export const store = Object.freeze(new StateManager());
