import "./sidebarPart.css";

export default function ({ children }) {
  return (
    <div className="sidebar-container">
      <div className="sidebar-scroller-wrapper">
        <div className="sidebar-scroller">
          <div className="sidebar-content">{children}</div>
        </div>
      </div>
    </div>
  );
}
