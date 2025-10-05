import Modal from "@oldcord/frontend-shared/components/modal";
import Button from "@oldcord/frontend-shared/components/button";
import { Text } from "@oldcord/frontend-shared/components/textComponent";
import { useState, useEffect } from "react";

import { PATCHES } from "../../../../constants/patches";

export default function ({
  onClose,
  onConfirm,
  selectedBuild,
  enabledPlugins,
}) {
  const [displayedBuild, setDisplayedBuild] = useState(selectedBuild);
  const [displayedPlugins, setDisplayedPlugins] = useState(enabledPlugins);

  useEffect(() => {
    if (selectedBuild) {
      setDisplayedBuild(selectedBuild);
    }
    if (enabledPlugins) {
      setDisplayedPlugins(enabledPlugins);
    }
  }, [selectedBuild, enabledPlugins]);

  if (!displayedBuild) {
    return null;
  }
  return (
    <Modal
      onClose={onClose}
      title="Build Confirmation"
      showCloseButton={false}
      size="small"
      footerAlignment="right"
      footer={
        <>
          <Button variant="ghost" onClick={() => onClose(false)}>Cancel</Button>
          <Button onClick={() => onConfirm()}>Launch</Button>
        </>
      }
    >
      <div style={{ paddingBottom: "20px" }}>
        <Text variant="body">Selected Build: {displayedBuild}</Text>
        {displayedPlugins && displayedPlugins.length > 0 && (
          <>
            <Text variant="body" style={{ marginTop: "16px" }}>
              Enabled plugins and patches:
            </Text>
            <ul style={{ margin: "8px 0 0 20px", padding: 0 }}>
              {displayedPlugins.map((plugin, index) => (
                <li key={index} style={{ margin: "4px 0" }}>
                  <Text variant="body">{PATCHES[plugin].label}</Text>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Modal>
  );
}
