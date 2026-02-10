import { useCallback, useEffect, useState } from 'react';

import DropdownList from '@oldcord/frontend-shared/components/dropdownList';
import InfoCard from '@oldcord/frontend-shared/components/infoCard';
import { Text } from '@oldcord/frontend-shared/components/textComponent';
import { useUnsavedChanges } from '@oldcord/frontend-shared/hooks/unsavedChangesHandler';

import OptionsCard from '../../../../components/shared/optionsCard';
import { builds } from '../../../../constants/builds';
import { PATCHES } from '../../../../constants/patches';
import { useOldplugerPlugins } from '../../../../hooks/oldplungerPluginsHandler';
import { convertBuildIds } from '../../../../lib/convertBuildIds';
import { convertBuildId } from '../../../../lib/convertBuildIds';
import cookieManager from '../../../../lib/cookieManager';
import localStorageManager from '../../../../lib/localStorageManager';

const settingsLSKey = 'oldcord_settings';

export default function () {
  const friendlyBuildIds = convertBuildIds(builds);
  const { plugins: availablePlugins, loading: pluginsLoading } = useOldplugerPlugins();

  const defaultBuild =
    cookieManager.get('release_date') ?? cookieManager.get('default_client_build') ?? builds[0];

  const [selectedBuild, setSelectedBuild] = useState(convertBuildId(defaultBuild));

  let selectedBuildOriginal = builds[friendlyBuildIds.indexOf(selectedBuild)];

  const localStorageCEP = localStorageManager.get(settingsLSKey);

  const [pendingChangePatches, setPendingChangePatches] = useState(
    localStorageCEP.selectedPatches[selectedBuildOriginal] || [],
  );

  const [pendingChangePlugins, setPendingChangePlugins] = useState(
    localStorageCEP.selectedPlugins[selectedBuildOriginal] || [],
  );

  const [hasIncompatibleItems, setHasIncompatibleItems] = useState(null);

  function resetToSelected(type) {
    switch (type) {
      case 'legacy': {
        return localStorageCEP.selectedPatches[selectedBuildOriginal] || [];
      }
      case 'oldplunger': {
        return localStorageCEP.selectedPlugins[selectedBuildOriginal] || [];
      }
    }
  }

  function getItemConstants(itemKey, type) {
    switch (type) {
      case 'legacy': {
        return PATCHES[itemKey];
      }
      case 'oldplunger': {
        return availablePlugins?.[itemKey];
      }
    }
  }

  function getPendingItems(type) {
    return type === 'legacy' ? pendingChangePatches : pendingChangePlugins;
  }

  function setPendingItems(type, itemsOrUpdater) {
    if (type === 'legacy') {
      setPendingChangePatches(itemsOrUpdater);
    } else {
      setPendingChangePlugins(itemsOrUpdater);
    }
  }

  const { setHasUnsavedChanges, hasUnsavedChanges, registerHandlers, triggerNudge } =
    useUnsavedChanges();

  const handleToggle = (itemKey, type) => {
    const itemConstants = getItemConstants(itemKey, type);
    if (!itemConstants) return;

    const currentPendingPatches =
      type === 'legacy' ? getPendingItems('legacy') : pendingChangePatches;
    const currentPendingPlugins =
      type === 'oldplunger' ? getPendingItems('oldplunger') : pendingChangePlugins;

    const isTogglingOn = !(type === 'legacy' ? currentPendingPatches : currentPendingPlugins).includes(
      itemKey,
    );

    if (isTogglingOn) {
      const incompatiblePatches = itemConstants.incompatiblePatches || [];
      const incompatiblePlugins = itemConstants.incompatiblePlugins || [];

      const foundConflicts = [
        ...incompatiblePatches
          .filter((p) => currentPendingPatches.includes(p))
          .map((p) => `legacy-${p}`),
        ...incompatiblePlugins
          .filter((p) => currentPendingPlugins.includes(p))
          .map((p) => `oldplunger-${p}`),
      ];

      if (foundConflicts.length > 0) {
        setHasIncompatibleItems((prev) => ({
          ...(prev || {}),
          [`${type}-${itemKey}`]: foundConflicts,
        }));
      }
    } else {
      setHasIncompatibleItems((prev) => {
        if (!prev) return null;
        const next = { ...prev };
        const itemKeyWithType = `${type}-${itemKey}`;

        delete next[itemKeyWithType];

        Object.keys(next).forEach((key) => {
          next[key] = next[key].filter(
            (conflictingKeyWithType) => conflictingKeyWithType !== itemKeyWithType,
          );
          if (next[key].length === 0) delete next[key];
        });

        return Object.keys(next).length === 0 ? null : next;
      });
    }

    setPendingItems(type, (previousItems) => {
      if (previousItems.includes(itemKey)) {
        return previousItems.filter((item) => item !== itemKey);
      } else {
        return [...previousItems, itemKey];
      }
    });
  };

  const handleSave = useCallback(() => {
    if (hasIncompatibleItems) {
      triggerNudge();
      return;
    }
    localStorageCEP.selectedPatches[selectedBuildOriginal] = pendingChangePatches;
    localStorageCEP.selectedPlugins[selectedBuildOriginal] = pendingChangePlugins;
    localStorageManager.set(settingsLSKey, localStorageCEP);
    setHasUnsavedChanges(false);
  }, [
    setHasUnsavedChanges,
    pendingChangePatches,
    pendingChangePlugins,
    hasIncompatibleItems,
    selectedBuildOriginal,
    localStorageCEP,
    triggerNudge,
  ]);

  const handleReset = useCallback(() => {
    setPendingChangePatches(resetToSelected('legacy'));
    setPendingChangePlugins(resetToSelected('oldplunger'));
    setHasUnsavedChanges(false);
    setHasIncompatibleItems(null);
  }, [setHasUnsavedChanges, selectedBuildOriginal, localStorageCEP]);

  useEffect(() => {
    registerHandlers(handleSave, handleReset);

    return () => {
      setHasUnsavedChanges(false);
      registerHandlers(
        () => {},
        () => {},
      );
    };
  }, [registerHandlers, handleSave, handleReset, setHasUnsavedChanges]);

  useEffect(() => {
    const patchesMatch =
      JSON.stringify(localStorageCEP.selectedPatches[selectedBuildOriginal] || []) ===
      JSON.stringify(pendingChangePatches);
    const pluginsMatch =
      JSON.stringify(localStorageCEP.selectedPlugins[selectedBuildOriginal] || []) ===
      JSON.stringify(pendingChangePlugins);

    if (patchesMatch && pluginsMatch) {
      setHasUnsavedChanges(false);
    } else {
      setHasUnsavedChanges(true);
    }
  }, [pendingChangePatches, pendingChangePlugins, selectedBuildOriginal, localStorageCEP]);

  function changeSelectedBuild(selectedBuild) {
    if (hasUnsavedChanges) {
      triggerNudge();
      return false;
    }
    setSelectedBuild(selectedBuild);
    selectedBuildOriginal = builds[friendlyBuildIds.indexOf(selectedBuild)];
    setPendingChangePatches(localStorageCEP.selectedPatches[selectedBuildOriginal] || []);
    setPendingChangePlugins(localStorageCEP.selectedPlugins[selectedBuildOriginal] || []);
  }

  function isDisabled(key, type) {
    if (getItemConstants(key, type).mandatory || !getItemConstants(key, type).configurable) {
      return true;
    } else {
      return false;
    }
  }

  return (
    <>
      <Text variant='h2'>Plugins & Patches</Text>
      <InfoCard title='Plugin & Patches Management'>
        {!hasIncompatibleItems && (
          <>
            Press the cog wheel or info icon to get more info on a plugin or a patch.
            <br />
            Plugins and patches that have a cog wheel button have settings that you can modify!
            <br />
            You can also select different enabled plugins and patches for each build.
            <br />
            WARNING: Some patches/plugins are not compatible with each other! You'll be warned
            before saving.
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
                const [type, key] = itemKey.split('-', 2);
                const itemConstants = getItemConstants(key, type);
                return (
                  <li key={itemKey}>
                    <Text variant='body'>
                      {itemConstants?.name} is not compatible with{' '}
                      {hasIncompatibleItems[itemKey]
                        .map((conflictingKeyWithType) => {
                          const [cType, cKey] = conflictingKeyWithType.split('-', 2);
                          const conflictingConstants = getItemConstants(cKey, cType);
                          return conflictingConstants?.name || cKey;
                        })
                        .join(', ')}
                    </Text>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </InfoCard>
      <DropdownList
        label={'Client Build'}
        options={friendlyBuildIds}
        defaultOption={selectedBuild}
        onSelected={changeSelectedBuild}
        style={{ marginTop: '-20px' }}
        informativeText='This dropdown only manages patches/plugins for the selected build and does not change the client build launched.'
      />
      <Text variant='h5' style={{ marginBottom: '10px' }}>
        Plugins
      </Text>
      {!pluginsLoading && availablePlugins ? (
        <div className='options-grid'>
          {Object.keys(availablePlugins).map((key) => {
            const plugin = availablePlugins[key];
            const compatibleBuilds = plugin.compatibleBuilds;

            if (
              compatibleBuilds === 'all' ||
              selectedBuildOriginal.includes(compatibleBuilds) ||
              compatibleBuilds.includes(selectedBuildOriginal)
            )
              return (
                <OptionsCard
                  key={key}
                  cardId={key}
                  pluginType={'oldplunger'}
                  title={plugin.name}
                  description={plugin.description}
                  iconType={plugin.settings ? 'settings' : 'info'}
                  isEnabled={getPendingItems('oldplunger').includes(key)}
                  disabled={isDisabled(key, 'oldplunger')}
                  onToggle={() => handleToggle(key, 'oldplunger')}
                />
              );
          })}
        </div>
      ) : (
        <Text variant='body' style={{ marginTop: '0px' }}>
          {pluginsLoading ? 'Loading plugins...' : 'No plugins available.'}
        </Text>
      )}
      <Text variant='h5' style={{ marginTop: '20px', marginBottom: '10px' }}>
        Patches (Legacy)
      </Text>
      <div className='options-grid'>
        {Object.keys(PATCHES).map((key) => {
          const compatibleBuilds = PATCHES[key].compatibleBuilds;

          if (
            compatibleBuilds === 'all' ||
            selectedBuildOriginal.includes(compatibleBuilds) ||
            compatibleBuilds.includes(selectedBuildOriginal)
          )
            return (
              <OptionsCard
                key={key}
                cardId={key}
                pluginType={'legacy'}
                title={PATCHES[key].name}
                description={PATCHES[key].description}
                iconType={PATCHES[key].settings ? 'settings' : 'info'}
                isEnabled={getPendingItems('legacy').includes(key)}
                disabled={isDisabled(key, 'legacy')}
                onToggle={() => handleToggle(key, 'legacy')}
              />
            );
        })}
      </div>
    </>
  );
}
