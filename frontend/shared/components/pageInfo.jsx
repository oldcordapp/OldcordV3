import "./pageInfo.css";

export default function ({ title, children, style, className }) {
  return (
    <div className={`page-info-card ${className}`} style={style}>
      <h5 className="page-info-title">{title}</h5>
      <div className="page-info-body">{children}</div>
    </div>
  );
}
