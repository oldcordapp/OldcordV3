import Button from '@oldcord/frontend-shared/components/button';
import Modal from '@oldcord/frontend-shared/components/modal';
import { Text } from '@oldcord/frontend-shared/components/textComponent';

export default function ({ isOpen, onClose, onConfirm }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title='Report Content'
      showCloseButton={false}
      size='small'
      footerAlignment='right'
      footer={
        <>
          <Button variant='ghost' onClick={() => onClose()}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm()}
            variant='danger'
            style={{
              padding: '20px',
              width: 'auto',
            }}
          >
            Submit Report
          </Button>
        </>
      }
    >
      <div style={{ paddingBottom: '20px' }}>
        <Text variant='body'>
          By submitting, you{' '}
          <b>confirm that the information is accurate to the best of your ability.</b>
        </Text>
      </div>
    </Modal>
  );
}
