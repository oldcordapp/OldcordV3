import Modal from "@oldcord/frontend-shared/components/modal";
import { Text } from "@oldcord/frontend-shared/components/textComponent";
import { PATCHES } from "../../../../constants/patches";
import { useState, useEffect } from "react";
import { useOldplugerPlugins } from "../../../../hooks/oldplungerPluginsHandler";

export default function ({ onClose, plugin, type }) {
  const [cachedPluginData, setCachedPluginData] = useState(null);
  const { plugins } = useOldplugerPlugins();

  useEffect(() => {
    if (plugin && !cachedPluginData) {
      const pluginData =
        type === "oldplunger" ? plugins[plugin] : PATCHES[plugin];
      if (pluginData) {
        setCachedPluginData(pluginData);
      }
    }
  }, [plugin, type, plugins, cachedPluginData]);

  if (!cachedPluginData) {
    return null;
  }

  return (
    <Modal
      onClose={onClose}
      title={cachedPluginData.name}
      showCloseButton={true}
      size="medium"
    >
      <div style={{ paddingBottom: "20px" }}>
        <div style={{ display: "flex", gap: "1em" }}>
          <Text
            variant="body"
            style={{
              fontSize: "14px",
              fontWeight: "400",
              lineHeight: "1.285",
              marginBottom: "20px",
            }}
          >
            {cachedPluginData.description}
          </Text>
        </div>
        <Text
          variant="h1"
          style={{
            fontSize: "20px",
            fontWeight: "600",
            lineHeight: "1.2",
            transform: "scaleY(1.04)",
          }}
        >
          Authors
        </Text>
        <Text
          variant="body"
          style={{
            fontSize: "14px",
            fontWeight: "400",
            lineHeight: "1.285",
            marginBottom: "20px",
          }}
        >
          {cachedPluginData.authors.join(", ")}
        </Text>
        <Text
          variant="h1"
          style={{
            fontSize: "20px",
            fontWeight: "600",
            lineHeight: "1.2",
            transform: "scaleY(1.04)",
          }}
        >
          Settings
        </Text>
        <Text
          variant="body"
          style={{ fontSize: "14px", fontWeight: "400", lineHeight: "1.285" }}
        >
          There are no settings for this plugin/patch.
        </Text>
      </div>
    </Modal>
  );
}
