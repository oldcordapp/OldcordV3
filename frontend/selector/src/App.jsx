import { LayerHandler, useLayer } from "./hooks/layerHandler";
import {
  UnsavedChangesHandler,
  useUnsavedChanges,
} from "@oldcord/frontend-shared/hooks/unsavedChangesHandler";
import { useEffect, useRef } from "react";

import layerConfig from "./components/layerConfig";

import PrimaryLayer from "./components/layers/primaryLayer";
import "./App.css";

import localStorageManager from "./lib/localStorageManager";
import { PATCHES } from "./constants/patches";
import { builds } from "./constants/builds";
import {
  OldplungerPluginsHandler,
  useOldplugerPlugins,
} from "./hooks/oldplungerPluginsHandler";

function initializeLocalStorageKeys(plugins) {
  const localStorageKey = "oldcord_settings";

  let localStorageCEP = localStorageManager.get(localStorageKey);

  if (typeof localStorageCEP !== "object" || !localStorageCEP) {
    const initializedObject = { selectedPatches: {}, selectedPlugins: {} };

    builds.forEach((build) => {
      initializedObject.selectedPatches[build] = Object.keys(PATCHES).filter(
        (key) => {
          const patch = PATCHES[key];
          const compatibleBuilds = patch.compatibleBuilds;

          if (
            (compatibleBuilds === "all" ||
              build.includes(compatibleBuilds) ||
              compatibleBuilds.includes(build)) &&
            (patch.defaultEnabled || patch.mandatory)
          ) {
            return key;
          }
        }
      );

      if (plugins) {
        initializedObject.selectedPlugins[build] = Object.keys(plugins).filter(
          (key) => {
            const plugin = plugins[key];
            const compatibleBuilds = plugin.compatibleBuilds;

            if (
              (compatibleBuilds === "all" ||
                build.includes(compatibleBuilds) ||
                compatibleBuilds.includes(build)) &&
              (plugin.defaultEnabled || plugin.mandatory)
            ) {
              return key;
            }
          }
        );
      }
    });

    localStorageManager.set(localStorageKey, initializedObject);
    localStorageCEP = initializedObject;
  }

  let needsUpdate = false;
  builds.forEach((build) => {
    if (!localStorageCEP.selectedPatches) localStorageCEP.selectedPatches = {};
    if (!localStorageCEP.selectedPlugins) localStorageCEP.selectedPlugins = {};
    if (!localStorageCEP.selectedPatches[build]) {
      localStorageCEP.selectedPatches[build] = [];
    }
    if (!localStorageCEP.selectedPlugins[build]) {
      localStorageCEP.selectedPlugins[build] = [];
    }

    const isDesktop = !!window.DiscordNative;
    const selectedPatches = localStorageCEP.selectedPatches[build];
    const hasElectronPatch = selectedPatches.includes("electronPatch");

    if (isDesktop && !hasElectronPatch) {
      localStorageCEP.selectedPatches[build].push("electronPatch");
      localStorageCEP.selectedPlugins[build].push("electronPatch");
      needsUpdate = true;
    } else if (!isDesktop && hasElectronPatch) {
      localStorageCEP.selectedPatches[build] = localStorageCEP.selectedPatches[
        build
      ].filter((p) => p !== "electronPatch");

      localStorageCEP.selectedPlugins[build] = localStorageCEP.selectedPlugins[
        build
      ].filter((p) => p !== "electronPatch");

      needsUpdate = true;
    }

    Object.keys(PATCHES).forEach((key) => {
      const patch = PATCHES[key];
      const compatible =
        patch.compatibleBuilds === "all" ||
        build.includes(patch.compatibleBuilds) ||
        patch.compatibleBuilds.includes(build);

      if (
        compatible &&
        patch.mandatory &&
        !localStorageCEP.selectedPatches[build].includes(key)
      ) {
        localStorageCEP.selectedPatches[build].push(key);
        needsUpdate = true;
      }
    });

    if (plugins) {
      Object.keys(plugins).forEach((key) => {
        const plugin = plugins[key];
        const compatible =
          plugin.compatibleBuilds === "all" ||
          build.includes(plugin.compatibleBuilds) ||
          plugin.compatibleBuilds.includes(build);

        if (
          compatible &&
          plugin.mandatory &&
          !localStorageCEP.selectedPlugins[build].includes(key)
        ) {
          localStorageCEP.selectedPlugins[build].push(key);
          needsUpdate = true;
        }
      });
    }
  });

  if (needsUpdate) {
    localStorageManager.set(localStorageKey, localStorageCEP);
  }
}

function Container() {
  const { activeLayer, exitingLayer, triggeredRedirect } = useLayer();
  const { isNudging } = useUnsavedChanges();
  const { plugins, loading } = useOldplugerPlugins();
  const ref = useRef(null);

  useEffect(() => {
    let intervalId;
    if (isNudging) {
      intervalId = setInterval(() => {
        if (ref.current) {
          const randomY = Math.random() * 30 - 15;
          const randomX = Math.random() < 0.5 ? 15 : -15;
          ref.current.style.transform = `translate3d(${randomX}px, ${randomY}px, 0)`;
        }
      }, 10);
    } else if (ref.current) {
      ref.current.style.transform = "";
    }
    return () => clearInterval(intervalId);
  }, [isNudging]);

  useEffect(() => {
    let redirectTimeout;
    if (triggeredRedirect) {
      redirectTimeout = setInterval(() => {
        window.location.href = `${location.protocol}//${location.host}`;
      }, 500);
    }
    return () => clearInterval(redirectTimeout);
  }, [triggeredRedirect]);

  useEffect(() => {
    if (!loading) {
      initializeLocalStorageKeys(plugins);
    }
  }, [loading]);

  const layerKey = activeLayer || exitingLayer;
  const CurrentLayer = layerKey ? layerConfig[layerKey]?.Component : null;

  return (
    <div ref={ref}>
      <PrimaryLayer />
      {CurrentLayer && <CurrentLayer />}
    </div>
  );
}

export default function App() {
  return (
    <LayerHandler>
      <UnsavedChangesHandler>
        <OldplungerPluginsHandler>
          <Container />
        </OldplungerPluginsHandler>
      </UnsavedChangesHandler>
    </LayerHandler>
  );
}
