import "./PageInfo.css";

export default function ({ title, children, style }) {
  return (
    <div className="page-info-card" style={{...style, marginTop: "20px"}}>
      <h5 className="page-info-title">{title}</h5>
      <div className="page-info-body">{children}</div>
    </div>
  );
}
