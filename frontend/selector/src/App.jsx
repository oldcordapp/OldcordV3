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
          const compatibleBuilds = PATCHES[key].compatibleBuilds;

          if (
            (compatibleBuilds === "all" ||
              build.includes(compatibleBuilds) ||
              compatibleBuilds.includes(build)) &&
            PATCHES[key].defaultEnabled
          ) {
            return key;
          }
        }
      );

      if (plugins) {
        initializedObject.selectedPlugins[build] = Object.keys(plugins).filter(
          (key) => {
            const compatibleBuilds = plugins[key].compatibleBuilds;

            if (
              (compatibleBuilds === "all" ||
                build.includes(compatibleBuilds) ||
                compatibleBuilds.includes(build)) &&
              plugins[key].defaultEnabled
            ) {
              return key;
            }
          }
        );
      }
    });

    localStorageManager.set(localStorageKey, initializedObject);
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
    if (triggeredRedirect) {
      setInterval(() => {
        window.location = `${location.protocol}//${location.host}`;
      }, 300);
    }
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
