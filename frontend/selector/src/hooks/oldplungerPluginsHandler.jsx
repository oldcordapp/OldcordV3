import contextFactory from "@oldcord/frontend-shared/hooks/contextFactory";
import { useState, useEffect } from "react";

async function fetchOldPlungerPlugins() {
  try {
    const response = await fetch(
      `${location.protocol}//${location.host}/assets/oldplunger/plugins.json`
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch plunger plugins:", error);
    return null;
  }
}

function useOldplungerPluginsState() {
  const [plugins, setPlugins] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPlugins = async () => {
      setLoading(true);
      const data = await fetchOldPlungerPlugins();
      if (data) {
        setPlugins(data);
      } else {
        console.log("Failed to load plugins.");
      }
      setLoading(false);
    };

    loadPlugins();
  }, []);

  return {
    plugins,
    loading,
  };
}

const { Provider, useContextHook } = contextFactory(useOldplungerPluginsState);

export const OldplungerPluginsHandler = Provider;
export const useOldplugerPlugins = useContextHook;
