import { useEffect, useState } from "react";
import PageInfo from "@oldcord/frontend-shared/components/pageInfo";
import ToggleSetting from "@oldcord/frontend-shared/components/toggleSetting";
import { Text } from "@oldcord/frontend-shared/components/textComponent";

import cookieManager from "../../../../lib/cookieManager";

const oldplungerEnabledKey = "oldplunger_enabled";

export default function () {
  const [oldplungerEnabled, setOldplungerEnabled] = useState(cookieManager.get(oldplungerEnabledKey) === "true" ? true : false);

  function enableOldplunger() {
    const newValue = !oldplungerEnabled;
    setOldplungerEnabled(newValue);
    cookieManager.set(oldplungerEnabledKey, newValue);
  }

  return (
    <>
      <Text variant="h1">Oldplunger Settings</Text>
      <PageInfo title="Oldplunger Development Notice">
        Oldplunger is in development!
        <br />
        All settings below with either be removed or changed upon release.
        <br />
        Please help us test Oldplunger!
      </PageInfo>
      <ToggleSetting
        title={"Enable Oldplunger"}
        description={"Enable the next generation of Oldcord modding. !In development!"}
        isChecked={oldplungerEnabled}
        onChange={enableOldplunger}
      />
      <div className="divider" />
    </>
  );
}
