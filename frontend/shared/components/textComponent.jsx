import React from "react";
import "./textComponent.css";

const variantMap = {
  h1: "h1",
  h2: "h2",
  h3: "h3",
  h4: "h4",
  h5: "h5",
  body: "p",
  caption: "span",
  label: "label",
};

export const Text = React.forwardRef(
  ({ as, variant = "body", className = "", children, ...rest }, ref) => {
    const Component = as || variantMap[variant] || "p";

    const combinedClassName = [variant, className].join(" ");

    return (
      <Component ref={ref} className={combinedClassName} {...rest}>
        {children}
      </Component>
    );
  }
);
