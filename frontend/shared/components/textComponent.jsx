import React from "react";
import styles from "./textComponent.module.css";

const variantMap = {
  h1: "h1",
  h2: "h2",
  h3: "h3",
  h4: "h4",
  body: "p",
  caption: "span",
  label: "label",
};

const variantClasses = {
  h1: styles.h1,
  h2: styles.h2,
  h3: styles.h3,
  h4: styles.h4,
  body: styles.body,
  caption: styles.caption,
  label: styles.label,
};

export const Text = React.forwardRef(
  ({ as, variant = "body", className = "", children, ...rest }, ref) => {
    const Component = as || variantMap[variant] || "p";

    const combinedClassName = [
      styles.base,
      variantClasses[variant] || styles.body,
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <Component ref={ref} className={combinedClassName} {...rest}>
        {children}
      </Component>
    );
  }
);
