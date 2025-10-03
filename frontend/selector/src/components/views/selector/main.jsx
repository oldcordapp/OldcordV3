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

export default function () {
  const [instance, setInstance] = useState(null);

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
              options={builds}
              defaultOption={builds[0]}
              style={{ marginBottom: "20px" }}
            />
            <Button>
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
            <Button style={{width: "100%"}}>Launch!</Button>
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
