import Modal from "@oldcord/frontend-shared/components/modal";

export default function ({ onClose }) {
  return (
    <Modal
      onClose={onClose}
      title="Changelog"
      subtitle="4 October 2025"
      showCloseButton={true}
      size="medium"
      footerAlignment="left"
      footer={
        <div className="modal-footer-text">
          Missed an update?{" "}
          <a href="https://github.com/oldcordapp/OldcordV3/commits/main/">Check out our commit history on our GitHub!</a>
        </div>
      }
      style={{width: "490px", minHeight: "unset", maxHeight: "800px"}}
    >
      <div style={{paddingBottom: "20px", userSelect: "all"}}>
        We've introduced a LOT of changes to Oldcord for the past month or so, let's do a rapid fire of changes that we've done this month!
      </div>
    </Modal>
  );
}
