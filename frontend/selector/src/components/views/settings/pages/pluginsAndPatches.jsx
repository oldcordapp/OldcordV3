import { useState, useEffect, useCallback } from "react";
import { Text } from "@oldcord/frontend-shared/components/textComponent";
import DropdownList from "@oldcord/frontend-shared/components/dropdownList";
import { builds } from "../../../../constants/builds";
import PageInfo from "@oldcord/frontend-shared/components/pageInfo";
import { PATCHES } from "../../../../constants/patches";
import OptionsCard from "@oldcord/frontend-shared/components/optionsCard";
import { useUnsavedChanges } from "@oldcord/frontend-shared/hooks/unsavedChangesHandler";
import localStorageManager from "../../../../lib/localStorageManager";
import { convertBuildIds } from "../../../../lib/convertBuildIds";

const localStorageKey = "oldcord_selected_patches";

export default function () {
  const friendlyBuildIds = convertBuildIds(builds);
  const [selectedBuild, setSelectedBuild] = useState(friendlyBuildIds[0]);

  let selectedBuildOriginal = builds[friendlyBuildIds.indexOf(selectedBuild)];

  let localStorageCEP = localStorageManager.get(localStorageKey);

  function initializeSelectedPatches() {
    if (typeof localStorageCEP !== "object" || !localStorageCEP) {
      const initializedObject = {};

      builds.forEach((build) => {
        initializedObject[build] = Object.keys(PATCHES).filter((key) => {
          const compatibleBuilds = PATCHES[key].compatibleVersions;

          if (
            (compatibleBuilds === "all" ||
              build.includes(compatibleBuilds) ||
              compatibleBuilds.includes(build)) &&
            PATCHES[key].defaultEnabled
          ) {
            return key;
          }
        });
      });

      localStorageCEP = initializedObject;

      localStorageManager.set(localStorageKey, initializedObject);
    }

    return localStorageCEP[selectedBuildOriginal];
  }

  const [pendingChangePatches, setPendingChangePatches] = useState(
    initializeSelectedPatches()
  );

  const [hasIncompatiblePatches, setHasIncompatiblePatches] = useState(null);

  function resetToSelected() {
    return localStorageCEP[selectedBuildOriginal];
  }

  const {
    setHasUnsavedChanges,
    hasUnsavedChanges,
    registerHandlers,
    triggerNudge,
  } = useUnsavedChanges();

  const handleToggle = (patchToChange) => {
    if (PATCHES[patchToChange].notControllable) {
      return;
    }

    if (!pendingChangePatches.includes(patchToChange)) {
      const patchesThatAreIncompatible =
        PATCHES[patchToChange].incompatiblePatches;

      const incompatiblePatches =
        patchesThatAreIncompatible &&
        pendingChangePatches.filter((patch) => {
          return patchesThatAreIncompatible.includes(patch);
        });

      if (incompatiblePatches.length > 0) {
        if (!hasIncompatiblePatches) {
          setHasIncompatiblePatches({ [patchToChange]: incompatiblePatches });
        } else {
          setHasIncompatiblePatches((previousPatches) => {
            return { ...previousPatches, [patchToChange]: incompatiblePatches };
          });
        }
      }
    } else if (hasIncompatiblePatches) {
      setHasIncompatiblePatches((previousPatches) => {
        if (previousPatches[patchToChange]) {
          delete previousPatches[patchToChange];
        } else {
          Object.keys(previousPatches).forEach((patch) => {
            const newIncompatiblePatches = previousPatches[patch].filter(
              (patch) => patch !== patchToChange
            );
            if (newIncompatiblePatches.length > 0) {
              previousPatches[patch] = newIncompatiblePatches;
            } else {
              delete previousPatches[patch];
            }
          });
        }
        if (Object.keys(previousPatches).length === 0) {
          return null;
        } else {
          return previousPatches;
        }
      });
    }

    setPendingChangePatches((previousPatches) => {
      let newPatches;
      if (previousPatches.includes(patchToChange)) {
        newPatches = previousPatches.filter((patch) => patch !== patchToChange);
      } else {
        newPatches = [...previousPatches, patchToChange];
      }
      return newPatches;
    });
  };

  const handleSave = useCallback(() => {
    if (hasIncompatiblePatches) {
      return;
    }
    localStorageCEP[selectedBuildOriginal] = pendingChangePatches;
    localStorageManager.set(localStorageKey, localStorageCEP);
    setHasUnsavedChanges(false);
  }, [
    setHasUnsavedChanges,
    pendingChangePatches,
    hasIncompatiblePatches,
    selectedBuild,
  ]);

  const handleReset = useCallback(() => {
    setPendingChangePatches(resetToSelected());
    setHasUnsavedChanges(false);
    setHasIncompatiblePatches(null);
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
    if (
      JSON.stringify(localStorageCEP[selectedBuildOriginal]) ===
      JSON.stringify(pendingChangePatches)
    ) {
      setHasUnsavedChanges(false);
    } else {
      setHasUnsavedChanges(true);
    }
  }, [pendingChangePatches]);

  function changeSelectedBuild(selectedBuild) {
    if (hasUnsavedChanges) {
      triggerNudge();
      return false;
    }
    setSelectedBuild(selectedBuild);
    selectedBuildOriginal = builds[friendlyBuildIds.indexOf(selectedBuild)];
    setPendingChangePatches(localStorageCEP[selectedBuildOriginal]);
  }

  function controlEnabled(key) {
    if (window.DiscordNative && key === "electronPatch") {
      return "forcedEnabled";
    } else if (!window.DiscordNative && key === "electronPatch") {
      return "forcedDisabled";
    } else {
      return pendingChangePatches.includes(key);
    }
  }

  return (
    <>
      <Text variant="h1">Plugins & Patches</Text>
      <PageInfo title="Plugin & Patches Management">
        {!hasIncompatiblePatches && (
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
            WARNING: Some patches are not compatible with each other! You'll be
            warned before saving.
          </>
        )}
        {hasIncompatiblePatches && (
          <>
            Incompatible patches are selected!
            <br />
            Please make sure the following patches are resolved.
            <br />
            <ul>
              {Object.keys(hasIncompatiblePatches).map((patch) => {
                return (
                  <li key={patch}>
                    {PATCHES[patch].label} is not comptaible with{" "}
                    {hasIncompatiblePatches[patch]
                      .map((patch) => {
                        return PATCHES[patch].label;
                      })
                      .join(", ")}
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
      />
      <Text variant="h2">Plugins</Text>
      <Text variant="body">Oldplunger is in development...</Text>
      <Text variant="h2">Patches (Legacy)</Text>
      <div className="options-grid">
        {Object.keys(PATCHES).map((key) => {
          const compatibleBuilds = PATCHES[key].compatibleVersions;

          if (
            compatibleBuilds === "all" ||
            selectedBuildOriginal.includes(compatibleBuilds) ||
            compatibleBuilds.includes(selectedBuildOriginal)
          )
            return (
              <OptionsCard
                key={key}
                title={PATCHES[key].label}
                description={PATCHES[key].description}
                iconType={"info"}
                isEnabled={controlEnabled(key)}
                onToggle={() => handleToggle(key)}
              />
            );
        })}
      </div>
    </>
  );
}
