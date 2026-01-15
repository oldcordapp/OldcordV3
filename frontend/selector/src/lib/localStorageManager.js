export default {
  isSupported() {
    try {
      const testKey = "__testLocalStorage__";
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      console.warn(
        "LocalStorage is not supported or is disabled in this browser."
      );
      return false;
    }
  },

  set(key, value) {
    if (!this.isSupported()) return;

    try {
      const serializedValue = JSON.stringify(value);
      localStorage.setItem(key, serializedValue);
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  },

  get(key) {
    if (!this.isSupported()) return null;

    try {
      const serializedValue = localStorage.getItem(key);
      if (serializedValue === null) {
        return null;
      }
      return JSON.parse(serializedValue);
    } catch (error) {
      return localStorage.getItem(key);
    }
  },
  update(key, updates) {
    if (!this.isSupported()) return;

    const currentValue = this.get(key);

    if (
      typeof currentValue === "object" &&
      currentValue !== null &&
      !Array.isArray(currentValue)
    ) {
      const newValue = { ...currentValue, ...updates };
      this.set(key, newValue);
    } else {
      console.warn(
        `Cannot update key "${key}". The existing value is not a plain object.`
      );
    }
  },
  remove(key) {
    if (!this.isSupported()) return;

    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing localStorage key "${key}":`, error);
    }
  },
  clear() {
    if (!this.isSupported()) return;

    try {
      localStorage.clear();
    } catch (error) {
      console.error("Error clearing localStorage:", error);
    }
  },
};
