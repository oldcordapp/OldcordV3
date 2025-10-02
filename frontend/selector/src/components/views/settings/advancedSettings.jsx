import { Text } from "@oldcord/frontend-shared";
import Button from "@oldcord/frontend-shared/components/button";
import ToggleSetting from "@oldcord/frontend-shared/components/toggleSettings";

export default function () {
  return (
    <>
      <Text variant="h1">Advanced Settings</Text>
      <ToggleSetting
        title={"Verbose Mode"}
        description={"Allows easier debugging."}
      />
      <div className="divider" />
      <Text variant="h1">Deprecated</Text>
      <Button style={{width: "max-content"}}>Remove stored failed chunk cache</Button>
    </>
  );
}
