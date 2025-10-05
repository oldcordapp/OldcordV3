import "./sidebarPart.css";

export default function ({ children }) {
  return (
    <div className="sidebar-container">
      <div className="scroller-wrapper">
        <div className="scroller">
          <div className="sidebar-content">{children}</div>
        </div>
      </div>
    </div>
  );
}
