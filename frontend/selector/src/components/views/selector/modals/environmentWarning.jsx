import Modal from '@oldcord/frontend-shared/components/modal';
import Button from '@oldcord/frontend-shared/components/button';
import { Text } from '@oldcord/frontend-shared/components/textComponent';
import { useState, useEffect } from 'react';

export default function ({ isOpen, onClose, onConfirm, environment }) {
  const [displayedEnvironment, setDisplayedEnvironment] = useState(environment);

  useEffect(() => {
    if (environment) {
      setDisplayedEnvironment(environment);
    }
  }, [environment]);

  if (!displayedEnvironment) {
    return null;
  }
  const getEnvironmentName = (env) => {
    return env.charAt(0).toUpperCase() + env.slice(1);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${getEnvironmentName(displayedEnvironment)} Warning`}
      showCloseButton={false}
      size="small"
      footerAlignment="right"
      footer={
        <>
          <Button variant="ghost" onClick={() => onClose(false)}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm()}>Continue</Button>
        </>
      }
    >
      <div style={{ paddingBottom: '20px' }}>
        <Text variant="body">
          This is a/an {displayedEnvironment} instance and may be unstable. Do you want to continue?
        </Text>
      </div>
    </Modal>
  );
}
