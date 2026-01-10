import './main.css';

import Button from '@oldcord/frontend-shared/components/button';
import Card from '@oldcord/frontend-shared/components/card';
import DropdownList from '@oldcord/frontend-shared/components/dropdownList';
import { Text } from '@oldcord/frontend-shared/components/textComponent';
import { useEffect, useState } from 'react';

import Download from '../../../assets/download.svg?react';
import { builds } from '../../../constants/builds';
import { useLayer } from '../../../hooks/layerHandler';
import { convertBuildId,convertBuildIds } from '../../../lib/convertBuildIds';
import cookieManager from '../../../lib/cookieManager';
import localStorageManager from '../../../lib/localStorageManager';
import Background from './background';
import BuildChangelogCard from './buildChangelogCard';
import Logo from './logo';
import BuildConfirmation from './modals/buildConfirmation';
import EnvironmentWarning from './modals/environmentWarning';
import LegalAgreement from './modals/legalAgreement';
import OpfsComingSoon from './modals/opfsComingSoon';
import SettingsButton from './settingsButton';

export default function () {
  const [instance, setInstance] = useState(null);
  const { changeLayer, setTriggeredRedirect } = useLayer();

  const [isOpfsModalOpen, setIsOpfsModalOpen] = useState(false);
  const [buildConfirmationState, setBuildConfirmationState] = useState({
    isOpen: false,
    resolve: null,
    props: {},
  });
  const [environmentWarningState, setEnvironmentWarningState] = useState({
    isOpen: false,
    resolve: null,
    props: {},
  });
  const [legalAgreementState, setLegalAgreementState] = useState({
    isOpen: false,
    resolve: null,
    props: {},
  });

  if (!cookieManager.get('release_date')) {
    cookieManager.set(
      'release_date',
      cookieManager.get('default_client_build') ?? 'october_5_2017',
      { expires: 365 },
    );
  }

  const defaultBuild =
    cookieManager.get('release_date') ?? cookieManager.get('default_client_build') ?? builds[0];

  const [selectedBuild, setSelectedBuild] = useState(defaultBuild);

  useEffect(() => {
    async function fetchInstanceConfig() {
      try {
        const response = await fetch(`${location.protocol}//${location.host}/instance`);
        if (!response.ok) {
          setInstance({ error: 'Instance did not load' });
        }

        setInstance(await response.json());
      } catch (error) {
        setInstance({ error: 'Instance did not load' });
      }
    }
    fetchInstanceConfig();
  }, []);

  async function showBuildConfirmation() {
    const selectedBuildInfo = convertBuildId(selectedBuild);
    const allSelectedPatches = localStorageManager.get('oldcord_settings') ?? {};
    const enabledLegacyPatches = allSelectedPatches.selectedPatches[selectedBuild] ?? [];
    const enabledOldplungerPlugins = allSelectedPatches.selectedPlugins[selectedBuild] ?? [];

    const enabledPlugins = {
      legacy: enabledLegacyPatches,
      oldplunger: enabledOldplungerPlugins,
    };

    return new Promise((resolve) => {
      setBuildConfirmationState({
        isOpen: true,
        resolve,
        props: { selectedBuild: selectedBuildInfo, enabledPlugins },
      });
    });
  }

  async function showEnvironmentWarning() {
    if (!instance?.instance || instance.instance.environment === 'stable') {
      return true;
    }

    return new Promise((resolve) => {
      setEnvironmentWarningState({
        isOpen: true,
        resolve,
        props: { environment: instance.instance.environment },
      });
    });
  }

  async function showLegalAgreement() {
    if (cookieManager.has('legal_agreed')) {
      return true;
    }

    const legalLinks = [];

    if (instance?.instance?.legal) {
      if (instance.instance.legal.terms) {
        legalLinks.push({
          title: 'Terms',
          url: instance.instance.legal.terms,
        });
      }
      if (instance.instance.legal.privacy) {
        legalLinks.push({
          title: 'Privacy',
          url: instance.instance.legal.privacy,
        });
      }
      if (instance.instance.legal.instanceRules) {
        legalLinks.push({
          title: 'Instance Rules',
          url: instance.instance.legal.instanceRules,
        });
      }

      if (instance.instance.legal.extras) {
        Object.entries(instance.instance.legal.extras).forEach(([key, url]) => {
          legalLinks.push({ title: key, url });
        });
      }
    }

    return new Promise((resolve) => {
      setLegalAgreementState({
        isOpen: true,
        resolve,
        props: { legalLinks },
      });
    });
  }

  async function handleLaunch() {
    try {
      const buildConfirmed = await showBuildConfirmation();
      if (!buildConfirmed) return;

      const envConfirmed = await showEnvironmentWarning();
      if (!envConfirmed) return;

      const legalConfirmed = await showLegalAgreement();
      if (!legalConfirmed) return;

      setTriggeredRedirect(true);
      changeLayer('redirect', 500);
    } catch (error) {
      console.error('Error during launch process:', error);
    }
  }

  const friendlyBuildIds = convertBuildIds(builds);

  function onBuildChange(selectedFriendlyBuild) {
    const buildId = builds[friendlyBuildIds.indexOf(selectedFriendlyBuild)];
    cookieManager.set('release_date', buildId, { expires: 365 });
    setSelectedBuild(buildId);
  }

  return (
    <>
      <Background />
      <Logo />
      <div className="selector-view">
        <Card className="selector-card">
          <Text variant="body" className="version-three-text">
            V3
          </Text>
          <Text variant="h1">Oldcord Build Selector</Text>
          <Text variant="h2">Choose your preferred Discord build below</Text>
          <div className="build-option-section">
            <DropdownList
              label={'Client Build'}
              options={friendlyBuildIds}
              defaultOption={convertBuildId(selectedBuild)}
              style={{ marginBottom: '20px' }}
              onSelected={onBuildChange}
            />
            <Button
              style={{ marginTop: '10px' }}
              notImplemented={true}
              onClick={() => {
                setIsOpfsModalOpen(true);
              }}
            >
              <Download />
            </Button>
          </div>

          <Text variant="body" style={{ marginTop: '-10px' }}>
            Looking for patches or a way to report content? You can now find both options
            conveniently located in the Settings menu.
          </Text>

          <div className="important-information">
            <Text
              variant="body"
              style={{
                color: 'gray',
                borderBottom: '0.2px dotted #585757',
                borderTop: '0.2px dotted #585757',
                padding: '5px',
                background: '#33363b',
              }}
            >
              While there is only one official instance running with Oldcord, please keep in mind
              the defined rules that may exist in 3rd party Oldcord instances.
            </Text>

            <Text
              variant="body"
              style={{
                marginBottom: '10px',
                marginTop: '20px',
                color: 'rgb(240, 71, 71)',
              }}
            >
              Please be mindful of what you post, illegal content will be reported.
            </Text>
          </div>

          <div className="instance-section">
            {instance === null && <Text variant="h1">Loading...</Text>}
            {instance && instance.error && <Text variant="h1">{instance.error}</Text>}
            {instance && (
              <>
                <Text variant="h1">Welcome to {instance.instance.name}!</Text>
                <Text variant="h2" style={{ marginBottom: '20px' }}>
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
                      <a href={instance.instance.legal.extras[key]} key={key}>
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
              style={{ width: '100%' }}
            >
              Launch!
            </Button>
            <SettingsButton />
          </div>
        </Card>
        <BuildChangelogCard selectedBuild={selectedBuild} />
        <Text variant="label" className="notice">
          Oldcord is an old Discord historical preservation/revival project and is not affiliated
          with or endorsed by Discord, Inc.
        </Text>
      </div>
      <OpfsComingSoon isOpen={isOpfsModalOpen} onClose={() => setIsOpfsModalOpen(false)} />
      {buildConfirmationState.resolve && (
        <BuildConfirmation
          isOpen={buildConfirmationState.isOpen}
          {...buildConfirmationState.props}
          onClose={(confirmed) => {
            buildConfirmationState.resolve(confirmed);
            setBuildConfirmationState((s) => ({ ...s, isOpen: false }));
          }}
          onConfirm={() => {
            const enabledPatches = JSON.stringify(
              buildConfirmationState.props.enabledPlugins.legacy,
            );
            const enabledPlugins = JSON.stringify(
              buildConfirmationState.props.enabledPlugins.oldplunger,
            );
            const expires = new Date();
            expires.setDate(expires.getDate() + 365);

            document.cookie = `enabled_patches=${enabledPatches}; expires=${expires.toUTCString()}; path=/`;
            document.cookie = `enabled_plugins=${enabledPlugins}; expires=${expires.toUTCString()}; path=/`;
            buildConfirmationState.resolve(true);
            setBuildConfirmationState((s) => ({ ...s, isOpen: false }));
          }}
        />
      )}
      {environmentWarningState.resolve && (
        <EnvironmentWarning
          isOpen={environmentWarningState.isOpen}
          {...environmentWarningState.props}
          onClose={(confirmed) => {
            environmentWarningState.resolve(confirmed);
            setEnvironmentWarningState((s) => ({ ...s, isOpen: false }));
          }}
          onConfirm={() => {
            environmentWarningState.resolve(true);
            setEnvironmentWarningState((s) => ({ ...s, isOpen: false }));
          }}
        />
      )}
      {legalAgreementState.resolve && (
        <LegalAgreement
          isOpen={legalAgreementState.isOpen}
          {...legalAgreementState.props}
          onClose={(confirmed) => {
            legalAgreementState.resolve(confirmed);
            setLegalAgreementState((s) => ({ ...s, isOpen: false }));
          }}
          onConfirm={() => {
            cookieManager.set('legal_agreed', 'true', { expires: 365 });
            legalAgreementState.resolve(true);
            setLegalAgreementState((s) => ({ ...s, isOpen: false }));
          }}
        />
      )}
    </>
  );
}
