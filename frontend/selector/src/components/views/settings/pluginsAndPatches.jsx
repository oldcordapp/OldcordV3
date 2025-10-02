import { Text } from "@oldcord/frontend-shared";
import DropdownList from "@oldcord/frontend-shared/components/dropdownList";
import { builds } from "../../../constants/builds";
import PageInfo from "@oldcord/frontend-shared/components/pageInfo";

export default function () {
  return (
    <>
      <Text variant="h1">Plugins & Patches</Text>
      <PageInfo title="Plugin & Patches Management">
        Press the cog wheel or info icon to get more info on a plugin.
        <br />
        Plugins with a cog wheel have settings you can modify!
        <br />
        You can also select different enabled plugins and patches for each
        build.
      </PageInfo>
      <DropdownList
        label={"Client Build"}
        options={builds}
        defaultOption={builds[0]}
      />
    </>
  );
}
