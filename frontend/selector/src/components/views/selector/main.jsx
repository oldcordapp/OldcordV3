import Card from "@oldcord/frontend-shared/components/card";
import Background from "./background";
import Logo from "./logo";
import "./main.css";
import SettingsButton from "./settingsButton";

export default function () {
  return (
    <>
      <Background />
      <Logo />
      <div className="selector-view">
        <Card className="selector-card">
          Welcome to Oldcord Selector v3!
          <SettingsButton />
        </Card>
        <Card className="build-changlog-card">
          Build changelogs will be implemented soon!
        </Card>
      </div>
    </>
  );
}
