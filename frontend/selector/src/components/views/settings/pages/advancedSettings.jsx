import { Text } from "@oldcord/frontend-shared/components/textComponent";
import Button from "@oldcord/frontend-shared/components/button";
import ToggleSetting from "@oldcord/frontend-shared/components/toggleSetting";
import { useModal } from "@oldcord/frontend-shared/hooks/modalHandler";
import cookieManager from "../../../../lib/cookieManager";
import { useState, useEffect } from "react";

const verboseModeKey = "debug_mode";

export default function () {
  const { addModal } = useModal();
  const [verboseMode, setVerboseMode] = useState(cookieManager.get(verboseModeKey) === "true" ? true : false);

  function enableVerboseMode() {
    const newValue = !verboseMode;
    setVerboseMode(newValue);
    cookieManager.set(verboseModeKey, newValue);
  }

  return (
    <>
      <Text variant="h1">Advanced Settings</Text>
      <ToggleSetting
        title={"Verbose Mode"}
        description={"Allows easier debugging."}
        isChecked={verboseMode}
        onChange={enableVerboseMode}
      />
      <div className="divider" />
      <Text variant="h1">Deprecated</Text>
      <Button
        style={{ width: "100%" }}
        onClick={() => {
          addModal("removeChunkCache");
        }}
      >
        Remove stored failed chunk cache
      </Button>
    </>
  );
}
