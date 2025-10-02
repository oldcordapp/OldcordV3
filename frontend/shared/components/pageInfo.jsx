import "./PageInfo.css";

export default function ({ title, children }) {
  return (
    <div className="page-info-card">
      <h5 className="page-info-title">{title}</h5>
      <div className="page-info-body">{children}</div>
    </div>
  );
}
