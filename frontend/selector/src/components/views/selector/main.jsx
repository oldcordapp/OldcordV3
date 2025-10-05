import Card from "@oldcord/frontend-shared/components/card";
import Background from "./background";
import Logo from "./logo";
import "./main.css";
import SettingsButton from "./settingsButton";
import { Text } from "@oldcord/frontend-shared/components/textComponent";
import DropdownList from "@oldcord/frontend-shared/components/dropdownList";
import { builds } from "../../../constants/builds";
import Button from "@oldcord/frontend-shared/components/button";
import Download from "../../../assets/download.svg?react";
import { useEffect, useState } from "react";
import { convertBuildIds, convertBuildId } from "../../../lib/convertBuildIds";
import cookieManager from "../../../lib/cookieManager";
import { useModal } from "@oldcord/frontend-shared/hooks/modalHandler";
import { useLayer } from "../../../hooks/layerHandler";
import localStorageManager from "../../../lib/localStorageManager";

export default function () {
  const [instance, setInstance] = useState(null);
  const { addModal, removeModal } = useModal();
  const { changeLayer, setTriggeredRedirect } = useLayer();

  useEffect(() => {
    async function fetchInstanceConfig() {
      try {
        const response = await fetch(
          `${location.protocol}//${location.host}/instance`
        );
        if (!response.ok) {
          setInstance({ error: "Instance did not load" });
        }

        setInstance(await response.json());
      } catch (error) {
        setInstance({ error: "Instance did not load" });
      }
    }
    fetchInstanceConfig();
  }, []);

  async function handleLaunch() {
    const selectedBuild = convertBuildId(defaultBuild);
    const allSelectedPatches =
      localStorageManager.get("oldcord_selected_patches") ?? {};
    const enabledPlugins = allSelectedPatches[defaultBuild] ?? [];

    const buildConfirmed = await new Promise((resolve) => {
      addModal("buildConfirmation", {
        selectedBuild,
        enabledPlugins,
        onClose: (confirmed) => {
          removeModal();
          resolve(confirmed);
        },
        onConfirm: () => {
          const enabledPatches = JSON.stringify(enabledPlugins);
          const expires = new Date();
          expires.setDate(expires.getDate() + 365);

          document.cookie = `enabled_patches=${enabledPatches}; expires=${expires.toUTCString()}; path=/`;

          removeModal();
          resolve(true);
        },
      });
    });

    if (!buildConfirmed) return;

    if (
      instance &&
      instance.instance &&
      instance.instance.environment !== "stable"
    ) {
      const envConfirmed = await new Promise((resolve) => {
        addModal("environmentWarning", {
          environment: instance.instance.environment,
          onClose: (confirmed) => {
            removeModal();
            resolve(confirmed);
          },
          onConfirm: () => {
            removeModal();
            resolve(true);
          },
        });
      });

      if (!envConfirmed) return;
    }

    if (!cookieManager.has("legal_agreed")) {
      const legalLinks = [];

      if (instance && instance.instance && instance.instance.legal) {
        if (instance.instance.legal.terms) {
          legalLinks.push({
            title: "Terms",
            url: instance.instance.legal.terms,
          });
        }
        if (instance.instance.legal.privacy) {
          legalLinks.push({
            title: "Privacy",
            url: instance.instance.legal.privacy,
          });
        }
        if (instance.instance.legal.instanceRules) {
          legalLinks.push({
            title: "Instance Rules",
            url: instance.instance.legal.instanceRules,
          });
        }

        if (instance.instance.legal.extras) {
          Object.entries(instance.instance.legal.extras).forEach(
            ([key, url]) => {
              legalLinks.push({ title: key, url });
            }
          );
        }
      }

      const legalConfirmed = await new Promise((resolve) => {
        addModal("legalAgreement", {
          legalLinks,
          onClose: (confirmed) => {
            removeModal();
            resolve(confirmed);
          },
          onConfirm: () => {
            cookieManager.set("legal_agreed", "true", { expires: 365 });
            removeModal();
            resolve(true);
          },
        });
      });

      if (!legalConfirmed) return;
    }

    setTriggeredRedirect(true);
    changeLayer("redirect", 300);
  }

  const friendlyBuildIds = convertBuildIds(builds);

  const defaultBuild =
    cookieManager.get("release_date") ??
    cookieManager.get("default_client_build");

  function changeReleaseDate(selectedBuild) {
    cookieManager.set(
      "release_date",
      builds[friendlyBuildIds.indexOf(selectedBuild)]
    );
  }

  return (
    <>
      <Background />
      <Logo />
      <div className="selector-view">
        <Card className="selector-card">
          <Text variant="h1">Oldcord Build Selector</Text>
          <Text variant="h2" style={{ marginBottom: "20px" }}>
            Choose your preferred Discord build below
          </Text>
          <div className="build-option-section">
            <DropdownList
              label={"Client Build"}
              options={friendlyBuildIds}
              defaultOption={convertBuildId(defaultBuild)}
              style={{ marginBottom: "20px" }}
              onSelected={changeReleaseDate}
            />
            <Button
              onClick={() => {
                addModal("opfsComingSoon");
              }}
            >
              <Download />
            </Button>
          </div>

          <Text variant="body" style={{ marginBottom: "20px" }}>
            Looking for patches? They've moved to the settings menu!
          </Text>

          <Text variant="body">
            While there is only an official instance running with Oldcord,
            please keep in mind the defined rules that may exist in 3rd party
            Oldcord instances.
          </Text>

          <Text
            variant="body"
            style={{ marginBottom: "20px", color: "rgb(240, 71, 71)" }}
          >
            Please be mindful of what you post, illegal content will be
            reported.
          </Text>

          <div className="instance-section">
            {instance === null && <Text variant="h1">Loading...</Text>}
            {instance && instance.error && (
              <Text variant="h1">{instance.error}</Text>
            )}
            {instance && (
              <>
                <Text variant="h1">Welcome to {instance.instance.name}!</Text>
                <Text variant="h2" style={{ marginBottom: "20px" }}>
                  {instance.instance.description}
                </Text>
                <div className="legal">
                  {instance.instance.legal.terms && (
                    <a href={instance.instance.legal.terms}>
                      <Text>Terms</Text>
                    </a>
                  )}
                  {instance.instance.legal.privacy && (
                    <a href={instance.instance.legal.privacy}>
                      <Text>Privacy</Text>
                    </a>
                  )}
                  {instance.instance.legal.instanceRules && (
                    <a href={instance.instance.legal.instanceRules}>
                      <Text>Instance rules</Text>
                    </a>
                  )}
                  {Object.keys(instance.instance.legal.extras).map((key) => {
                    return (
                      <a href={instance.instance.legal.extras[key]}>
                        <Text>{key}</Text>
                      </a>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          <div className="buttons">
            <Button
              onClick={() => {
                handleLaunch();
              }}
              style={{ width: "100%" }}
            >
              Launch!
            </Button>
            <SettingsButton />
          </div>
        </Card>
        <Card className="build-changlog-card">
          Build changelogs will be implemented soon!
        </Card>
        <Text variant="label" className="notice">
          Oldcord is an old Discord historical preservation/revival project and
          is not affiliated with or endorsed by Discord, Inc.
        </Text>
      </div>
    </>
  );
}
