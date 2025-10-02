import "./button.css";

export default function ({ children, onClick, type = "button", ...props }) {
  return (
    <button type={type} className="button" onClick={onClick} {...props}>
      {children}
    </button>
  );
}
