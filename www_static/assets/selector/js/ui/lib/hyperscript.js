export function h(tagName, props, ...children) {
  const element = document.createElement(tagName);

  if (props) {
    for (const key in props) {
      const value = props[key];
      if (key.startsWith("on")) {
        const eventType = key.substring(2).toLowerCase();
        element.addEventListener(eventType, value);
      } else if (key === "style" && typeof value === "object") {
        Object.assign(element.style, value);
      } else if (key === "className") {
        element.setAttribute("class", value);
      } else if (typeof value === "boolean" && value) {
        element.setAttribute(key, "");
      } else {
        element.setAttribute(key, value);
      }
    }
  }

  children.flat(Infinity).forEach((child) => {
    if (child instanceof Node) {
      element.appendChild(child);
    } else if (typeof child === "string" || typeof child === "number") {
      element.appendChild(document.createTextNode(child));
    }
  });

  return element;
}
