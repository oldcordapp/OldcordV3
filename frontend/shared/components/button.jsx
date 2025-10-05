import "./button.css";

export default function ({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled = false,
  ...props
}) {
  const getClassName = () => {
    const classes = ["button"];

    if (variant) classes.push(`button-${variant}`);
    if (disabled) classes.push("button-disabled");

    return classes.join(" ");
  };

  return (
    <button
      type={type}
      className={getClassName()}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
