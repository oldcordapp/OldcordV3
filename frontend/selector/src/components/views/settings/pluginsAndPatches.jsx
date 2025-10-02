import { Text } from "@oldcord/frontend-shared";
import DropdownList from "@oldcord/frontend-shared/components/dropdownList";
import { builds } from "../../../constants/builds";
import PageInfo from "@oldcord/frontend-shared/components/pageInfo";

export default function () {
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
    </>
  );
}
