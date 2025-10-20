import { Text } from "@oldcord/frontend-shared/components/textComponent";
import Button from "@oldcord/frontend-shared/components/button";
import ToggleSetting from "@oldcord/frontend-shared/components/toggleSetting";
import cookieManager from "../../../../lib/cookieManager";
import { useState } from "react";
import RemoveChunkCache from "../modals/removeChunkCache";

const verboseModeKey = "debug_mode";

export default function () {
  const [isRemoveChunkCacheModalOpen, setIsRemoveChunkCacheModalOpen] =
    useState(false);
  const [verboseMode, setVerboseMode] = useState(
    cookieManager.get(verboseModeKey) === "true" ? true : false
  );

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
          setIsRemoveChunkCacheModalOpen(true);
        }}
      >
        Remove stored failed chunk cache
      </Button>
      <RemoveChunkCache
        isOpen={isRemoveChunkCacheModalOpen}
        onClose={() => setIsRemoveChunkCacheModalOpen(false)}
      />
    </>
  );
}
