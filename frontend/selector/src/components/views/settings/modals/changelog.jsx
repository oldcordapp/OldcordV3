import Modal from "@oldcord/frontend-shared/components/modal";
import Changelog from "../../../shared/changelog";
import { oldcordChangelog } from "../../../../constants/oldcordChangelog";

export default function ({ isOpen, onClose }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Changelog"
      subtitle="19 December 2025"
      showCloseButton={true}
      size="medium"
      footerAlignment="left"
      footer={
        <div className="modal-footer-text">
          Missed an update?{" "}
          <a href="https://github.com/oldcordapp/OldcordV3/commits/main/">
            Check out our commit history on our GitHub!
          </a>
        </div>
      }
      style={{ height: "800px", maxHeight: "100%" }}
    >
      <Changelog
          sections={oldcordChangelog.sections}
          image={oldcordChangelog.image}
          style={{
            paddingBottom: "20px",
            userSelect: "text",
            paddingRight: "0"
          }}
        />
    </Modal>
  );
}
