import Modal from "@oldcord/frontend-shared/components/modal";
import Changelog from "../../../shared/changelog";
import { oldcordChangelog } from "../../../../constants/oldcordChangelog";

export default function ({ onClose }) {
  return (
    <Modal
      onClose={onClose}
      title="Changelog"
      subtitle="5 October 2025"
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
      style={{ width: "490px", height: "800px", maxHeight: "100%" }}
    >
      <Changelog
          sections={oldcordChangelog.sections}
          style={{
            paddingBottom: "20px",
            userSelect: "all",
            paddingRight: "0"
          }}
        />
    </Modal>
  );
}
