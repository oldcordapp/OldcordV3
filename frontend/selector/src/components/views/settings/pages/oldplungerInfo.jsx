import { Text } from "@oldcord/frontend-shared/components/textComponent";
import PageInfo from "@oldcord/frontend-shared/components/pageInfo";

export default function () {
  return (
    <>
      <Text variant="h1">Oldplunger</Text>
      <PageInfo>
        Oldplunger is the next version of Oldcord modding.
        <br />
        This page will be removed a bit after Oldplunger reaches a usable state.
      </PageInfo>
      <div className="faq" style={{marginTop: '-20px'}}>
        <Text variant="h2" style={{}}>
          What is Oldplunger?
        </Text>
        <Text variant="body" style={{ marginBottom: "16px" }}>
          Oldplunger is the next version of patching Discord builds based of the
          following techniques: Ahead-of-time (AOT) and Just-in-Time (JIT) Direct
          patching, and Shimming/Polyfilling.
        </Text>
        <Text variant="h2" style={{}}>
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
        <Text variant="h2" style={{}}>
          Will Oldplunger act more like other Discord mods like Vencord,
          BetterDiscord, etc?
        </Text>
        <Text variant="body" style={{ marginBottom: "16px" }}>
          Yes.
        </Text>
        <Text variant="h2" style={{}}>
          Then, how can I enable/disable patches in the new Selector like before?
        </Text>
        <Text variant="body" style={{ marginBottom: "16px" }}>
          While we develop Oldplunger, we intended to make the transition as
          smooth as possible. To get farmiliar with Oldplunger, the "Plugins &
          Patches" tab will still allow to control the patches currently available
          in the current patching system.
        </Text>
        <Text variant="h2" style={{}}>
          I am a plugin developer! Will I be able to make plugins for Oldcord?
        </Text>
        <Text variant="body" style={{ marginBottom: "16px" }}>
          Yes.
        </Text>
        <Text variant="h2" style={{}}>
          I am a mod developer!
        </Text>
        <Text variant="body" style={{ marginBottom: "16px" }}>
          Please help Oldcord out by contributing! We are just a small team of
          people that had various skills, and making a client mod isn't one of
          them.
        </Text>
        <Text variant="h2" style={{}}>
          Would that decrease the value of the revival/archival aspect of the
          project?
        </Text>
        <Text variant="body" style={{ marginBottom: "16px" }}>
          No, people will be able to enable and disable plugins if they choose to.
          Most plugins/patches will be 100% optional and can be turned off. The
          default enabled options will be minimal QoL fixes or things that are
          required to work, for example: User Select in 2015, Modernize WebRTC
          patch, Disable Telemetry and Modern Electron Compatibility patch.
        </Text>
      </div>
    </>
  );
}
