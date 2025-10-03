import { useState } from "react";
import { Text } from "@oldcord/frontend-shared";
import DropdownList from "@oldcord/frontend-shared/components/dropdownList";
import { builds } from "../../../constants/builds";
import PageInfo from "@oldcord/frontend-shared/components/pageInfo";
import { PATCHES } from "../../../constants/patches";
import OptionsCard from "@oldcord/frontend-shared/components/optionsCard";

export default function () {
  const [selectedBuild, setSelectedBuild] = useState(null);

  const [patches, setPatches] = useState(() => {
    const newPatches = {};
    Object.keys(PATCHES).forEach((key) => {
      newPatches[key] = PATCHES[key].defaultEnabled;
    });
    return newPatches;
  });

  const handleToggle = (id) => {
    setPatches((prevPatches) => ({
      ...prevPatches,
      [id]: !prevPatches[id],
    }));
  };

  return (
    <>
      <Text variant="h1">Plugins & Patches</Text>
      <PageInfo title="Plugin & Patches Management">
        Press the cog wheel or info icon to get more info on a plugin or a
        patch.
        <br />
        Plugins and patches that have a cog wheel button have settings that you
        can modify!
        <br />
        You can also select different enabled plugins and patches for each
        build.
        <br />
        WARNING: Some patches are not compatible with each other! You'll be
        warned before saving.
      </PageInfo>
      <DropdownList
        label={"Client Build"}
        options={builds}
        defaultOption={builds[0]}
      />
      <Text variant="h2">Plugins</Text>
      <Text variant="body">Oldplunger is in development...</Text>
      <Text variant="h2">Patches</Text>
      <div className="options-grid">
        {Object.keys(PATCHES).map((key) => {
        return (
          <OptionsCard
            key={key}
            title={PATCHES[key].label}
            description={PATCHES[key].description}
            iconType={"info"}
            isEnabled={patches[key]}
            onToggle={() => handleToggle(key)}
          />
        );
      })}
      </div>
    </>
  );
}
