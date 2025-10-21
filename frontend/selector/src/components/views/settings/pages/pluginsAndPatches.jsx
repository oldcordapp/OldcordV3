import { useState, useEffect, useCallback } from "react";
import { Text } from "@oldcord/frontend-shared/components/textComponent";
import DropdownList from "@oldcord/frontend-shared/components/dropdownList";
import { builds } from "../../../../constants/builds";
import PageInfo from "@oldcord/frontend-shared/components/pageInfo";
import { PATCHES } from "../../../../constants/patches";
import OptionsCard from "@oldcord/frontend-shared/components/optionsCard";
import { useUnsavedChanges } from "@oldcord/frontend-shared/hooks/unsavedChangesHandler";
import { useOldplugerPlugins } from "../../../../hooks/oldplungerPluginsHandler";
import localStorageManager from "../../../../lib/localStorageManager";
import { convertBuildIds } from "../../../../lib/convertBuildIds";
import cookieManager from "../../../../lib/cookieManager";
import { convertBuildId } from "../../../../lib/convertBuildIds";

const settingsLSKey = "oldcord_settings";

export default function () {
  const friendlyBuildIds = convertBuildIds(builds);
  const { plugins: availablePlugins, loading: pluginsLoading } =
    useOldplugerPlugins();

  const defaultBuild =
    cookieManager.get("release_date") ??
    cookieManager.get("default_client_build") ??
    builds[0];

  const [selectedBuild, setSelectedBuild] = useState(
    convertBuildId(defaultBuild)
  );

  let selectedBuildOriginal = builds[friendlyBuildIds.indexOf(selectedBuild)];

  const localStorageCEP = localStorageManager.get(settingsLSKey);

  const [pendingChangePatches, setPendingChangePatches] = useState(
    localStorageCEP.selectedPatches[selectedBuildOriginal] || []
  );

  const [pendingChangePlugins, setPendingChangePlugins] = useState(
    localStorageCEP.selectedPlugins[selectedBuildOriginal] || []
  );

  const [hasIncompatibleItems, setHasIncompatibleItems] = useState(null);

  function resetToSelected(type) {
    switch (type) {
      case "legacy": {
        return localStorageCEP.selectedPatches[selectedBuildOriginal] || [];
      }
      case "oldplunger": {
        return localStorageCEP.selectedPlugins[selectedBuildOriginal] || [];
      }
    }
  }

  function getItemConstants(itemKey, type) {
    switch (type) {
      case "legacy": {
        return PATCHES[itemKey];
      }
      case "oldplunger": {
        return availablePlugins?.[itemKey];
      }
    }
  }

  function getPendingItems(type) {
    return type === "legacy" ? pendingChangePatches : pendingChangePlugins;
  }

  function setPendingItems(type, itemsOrUpdater) {
    if (type === "legacy") {
      setPendingChangePatches(itemsOrUpdater);
    } else {
      setPendingChangePlugins(itemsOrUpdater);
    }
  }

  const {
    setHasUnsavedChanges,
    hasUnsavedChanges,
    registerHandlers,
    triggerNudge,
  } = useUnsavedChanges();

  const handleToggle = (itemKey, type) => {
    const itemConstants = getItemConstants(itemKey, type);
    const currentItems = getPendingItems(type);

    if (!currentItems.includes(itemKey)) {
      const incompatibleItems =
        itemConstants.incompatiblePatches || itemConstants.incompatiblePlugins;

      const foundIncompatibleItems =
        incompatibleItems &&
        currentItems.filter((item) => {
          return incompatibleItems.includes(item);
        });

      if (foundIncompatibleItems.length > 0) {
        if (!hasIncompatibleItems) {
          setHasIncompatibleItems({
            [`${type}-${itemKey}`]: foundIncompatibleItems,
          });
        } else {
          setHasIncompatibleItems((previousItems) => {
            return {
              ...previousItems,
              [`${type}-${itemKey}`]: foundIncompatibleItems,
            };
          });
        }
      }
    } else if (hasIncompatibleItems) {
      setHasIncompatibleItems((previousItems) => {
        const itemKeyWithType = `${type}-${itemKey}`;
        if (previousItems[itemKeyWithType]) {
          delete previousItems[itemKeyWithType];
        } else {
          Object.keys(previousItems).forEach((key) => {
            const newIncompatibleItems = previousItems[key].filter(
              (item) => item !== itemKey
            );
            if (newIncompatibleItems.length > 0) {
              previousItems[key] = newIncompatibleItems;
            } else {
              delete previousItems[key];
            }
          });
        }
        if (Object.keys(previousItems).length === 0) {
          return null;
        } else {
          return previousItems;
        }
      });
    }

    setPendingItems(type, (previousItems) => {
      let newItems;
      if (previousItems.includes(itemKey)) {
        newItems = previousItems.filter((item) => item !== itemKey);
      } else {
        newItems = [...previousItems, itemKey];
      }
      return newItems;
    });
  };

  const handleSave = useCallback(() => {
    if (hasIncompatibleItems) {
      return;
    }
    localStorageCEP.selectedPatches[selectedBuildOriginal] =
      pendingChangePatches;
    localStorageCEP.selectedPlugins[selectedBuildOriginal] =
      pendingChangePlugins;
    localStorageManager.set(settingsLSKey, localStorageCEP);
    setHasUnsavedChanges(false);
  }, [
    setHasUnsavedChanges,
    pendingChangePatches,
    pendingChangePlugins,
    hasIncompatibleItems,
    selectedBuild,
  ]);

  const handleReset = useCallback(() => {
    setPendingChangePatches(resetToSelected("legacy"));
    setPendingChangePlugins(resetToSelected("oldplunger"));
    setHasUnsavedChanges(false);
    setHasIncompatibleItems(null);
  }, [setHasUnsavedChanges, selectedBuild]);

  useEffect(() => {
    registerHandlers(handleSave, handleReset);

    return () => {
      setHasUnsavedChanges(false);
      registerHandlers(
        () => {},
        () => {}
      );
    };
  }, [registerHandlers, handleSave, handleReset, setHasUnsavedChanges]);

  useEffect(() => {
    const patchesMatch =
      JSON.stringify(
        localStorageCEP.selectedPatches[selectedBuildOriginal] || []
      ) === JSON.stringify(pendingChangePatches);
    const pluginsMatch =
      JSON.stringify(
        localStorageCEP.selectedPlugins[selectedBuildOriginal] || []
      ) === JSON.stringify(pendingChangePlugins);

    if (patchesMatch && pluginsMatch) {
      setHasUnsavedChanges(false);
    } else {
      setHasUnsavedChanges(true);
    }
  }, [
    pendingChangePatches,
    pendingChangePlugins,
    selectedBuildOriginal,
    localStorageCEP,
  ]);

  function changeSelectedBuild(selectedBuild) {
    if (hasUnsavedChanges) {
      triggerNudge();
      return false;
    }
    setSelectedBuild(selectedBuild);
    selectedBuildOriginal = builds[friendlyBuildIds.indexOf(selectedBuild)];
    setPendingChangePatches(
      localStorageCEP.selectedPatches[selectedBuildOriginal] || []
    );
    setPendingChangePlugins(
      localStorageCEP.selectedPlugins[selectedBuildOriginal] || []
    );
  }

  function isDisabled(key, type) {
    if (
      getItemConstants(key, type).mandatory ||
      getItemConstants(key, type).notChangeable
    ) {
      return true;
    } else {
      return false;
    }
  }

  return (
    <>
      <Text variant="h1">Plugins & Patches</Text>
      <PageInfo title="Plugin & Patches Management">
        {!hasIncompatibleItems && (
          <>
            Press the cog wheel or info icon to get more info on a plugin or a
            patch.
            <br />
            Plugins and patches that have a cog wheel button have settings that
            you can modify!
            <br />
            You can also select different enabled plugins and patches for each
            build.
            <br />
            WARNING: Some patches/plugins are not compatible with each other!
            You'll be warned before saving.
          </>
        )}
        {hasIncompatibleItems && (
          <>
            Incompatible items are selected!
            <br />
            Please make sure the following conflicts are resolved.
            <br />
            <ul>
              {Object.keys(hasIncompatibleItems).map((itemKey) => {
                const [type, key] = itemKey.split("-", 2);
                const itemConstants = getItemConstants(key, type);
                return (
                  <li key={itemKey}>
                    <Text variant="body">
                      {itemConstants?.name} is not compatible with{" "}
                      {hasIncompatibleItems[itemKey]
                        .map((conflictingKey) => {
                          const conflictingType =
                            type === "legacy" ? "oldplunger" : "legacy";
                          const conflictingConstants = getItemConstants(
                            conflictingKey,
                            conflictingType
                          );
                          return conflictingConstants?.name || conflictingKey;
                        })
                        .join(", ")}
                    </Text>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </PageInfo>
      <DropdownList
        label={"Client Build"}
        options={friendlyBuildIds}
        defaultOption={selectedBuild}
        onSelected={changeSelectedBuild}
        style={{ marginTop: "-20px" }}
        informativeText="This dropdown only manages patches/plugins for the selected build and does not change the client build launched."
      />
      <Text variant="h2">Plugins</Text>
      {!pluginsLoading && availablePlugins ? (
        <div className="options-grid">
          {Object.keys(availablePlugins).map((key) => {
            const plugin = availablePlugins[key];
            const compatibleBuilds = plugin.compatibleBuilds;

            if (
              !plugin.doNotDebug &&
              (compatibleBuilds === "all" ||
                selectedBuildOriginal.includes(compatibleBuilds) ||
                compatibleBuilds.includes(selectedBuildOriginal))
            )
              return (
                <OptionsCard
                  key={key}
                  cardId={key}
                  pluginType={"oldplunger"}
                  title={plugin.name}
                  description={plugin.description}
                  iconType={plugin.settings ? "settings" : "info"}
                  isEnabled={getPendingItems("oldplunger").includes(key)}
                  disabled={isDisabled(key, "oldplunger")}
                  onToggle={() => handleToggle(key, "oldplunger")}
                />
              );
          })}
        </div>
      ) : (
        <Text variant="body" style={{ marginTop: "0px" }}>
          {pluginsLoading ? "Loading plugins..." : "No plugins available."}
        </Text>
      )}
      <Text variant="h2" style={{ marginTop: "10px" }}>
        Patches (Legacy)
      </Text>
      <div className="options-grid">
        {Object.keys(PATCHES).map((key) => {
          const compatibleBuilds = PATCHES[key].compatibleBuilds;

          if (
            compatibleBuilds === "all" ||
            selectedBuildOriginal.includes(compatibleBuilds) ||
            compatibleBuilds.includes(selectedBuildOriginal)
          )
            return (
              <OptionsCard
                key={key}
                cardId={key}
                pluginType={"legacy"}
                title={PATCHES[key].name}
                description={PATCHES[key].description}
                iconType={PATCHES[key].settings ? "settings" : "info"}
                isEnabled={getPendingItems("legacy").includes(key)}
                disabled={isDisabled(key, "legacy")}
                onToggle={() => handleToggle(key, "legacy")}
              />
            );
        })}
      </div>
    </>
  );
}
