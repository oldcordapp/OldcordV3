import Modal from "@oldcord/frontend-shared/components/modal";

export default function ({ isOpen, onClose, build }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Build Confirmation"
      showCloseButton={true}
      size="large"
      footer={
        <div className="modal-footer-text">
          Missed an update?{" "}
          <a href="https://github.com/oldcordapp/OldcordV3/commits/main/">Check out our commit history on our GitHub!</a>
        </div>
      }
    >
      <div style={{paddingBottom: "20px", userSelect: "all"}}>
        We've introduced a LOT of changed to Oldcord for the past month or so, let's do a rapid fire of changes that we've done this month!
      </div>
    </Modal>
  );
}
