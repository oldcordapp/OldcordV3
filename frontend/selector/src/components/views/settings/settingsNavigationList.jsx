import "@oldcord/frontend-shared/components/navigationList.css";

export default function () {
  return (
    <div className="nav-list">
      <div className="nav-header">Oldplunger</div>
      <div className="nav-item">Info</div>
      <div className="nav-item">Settings</div>
      <div className="nav-item">Plugins & Patches</div>
      <div className="nav-item">Themes</div>
      <div className="nav-separator"></div>
      <div className="nav-header">OPFS</div>
      <div className="nav-item">Download Queue</div>
      <div className="nav-item">Advanced Settings</div>
      <div className="nav-separator"></div>
      <div className="nav-header">Oldcord</div>
      <div className="nav-item">Changelog</div>
      <div className="nav-item">Advanced Settings</div>
      {/* Oldcord Server version here... */}
    </div>
  );
}
