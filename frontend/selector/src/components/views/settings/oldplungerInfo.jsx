import { Text } from "@oldcord/frontend-shared";

export default function () {
  return (
    <>
      <Text variant="h1">Oldplunger</Text>
      <Text variant="body" style={{ marginBottom: "16px" }}>
        Oldplunger is the next version of Oldcord modding.
      </Text>
      <Text variant="h2" style={{ marginBottom: "0" }}>
        What is Oldplunger?
      </Text>
      <Text variant="body" style={{ marginBottom: "16px" }}>
        Oldplunger is the next version of patching Discord builds based of the
        following techniques: Ahead-of-time (AOT) and Just-in-Time (JIT) Direct
        patching, and Shimming/Polyfilling.
      </Text>
      <Text variant="h2" style={{ marginBottom: "0" }}>
        What is the current system Oldcord uses, then? Why make a Discord mod
        now?
      </Text>
      <Text variant="body" style={{ marginBottom: "16px" }}>
        The current system on the bootloader is a AOT direct patching system
        that, admittedly, had grown out of it's intended purpose. It was
        supposed to do small patches, but we started heavily relied on it and
        thus experiencing development related pains. Not only that, we intend to
        expand the old builds with new features, and so the only way forward is
        to build a Discord mod.
      </Text>
      <Text variant="h2" style={{ marginBottom: "0" }}>
        Will Oldplunger act more like other Discord mods like Vencord,
        BetterDiscord, etc?
      </Text>
      <Text variant="body" style={{ marginBottom: "16px" }}>
        Yes.
      </Text>
      <Text variant="h2" style={{ marginBottom: "0" }}>
        Then, how can I enable/disable patches in the new Selector like before?
      </Text>
      <Text variant="body" style={{ marginBottom: "16px" }}>
        While we develop Oldplunger, we intended to make the transition as
        smooth as possible. To get farmiliar with Oldplunger, the "Plugins &
        Patches" tab will still allow to control the patches currently available
        in the current patching system.
      </Text>
    </>
  );
}
