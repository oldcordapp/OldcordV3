import Button from '@oldcord/frontend-shared/components/button';
import Modal from '@oldcord/frontend-shared/components/modal';
import { Text } from '@oldcord/frontend-shared/components/textComponent';

export default function ({ isOpen, onClose }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title='Future feature!'
      showCloseButton={false}
      size='small'
      footerAlignment='right'
      footer={
        <>
          <Button onClick={onClose}>I see!</Button>
        </>
      }
    >
      <div style={{ paddingBottom: '20px' }}>
        <Text variant='body'>This is a button for OPFS which is not implemented yet!</Text>
      </div>
    </Modal>
  );
}
