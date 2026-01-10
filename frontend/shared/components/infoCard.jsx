import './infoCard.css';

export default function ({ title, children, style }) {
  return (
    <div className={`info-card`} style={style}>
      <h5 className="info-title">{title}</h5>
      <div className="info-body">{children}</div>
    </div>
  );
}
