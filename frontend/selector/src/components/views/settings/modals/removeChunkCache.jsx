import Modal from "@oldcord/frontend-shared/components/modal";
import localStorageManager from "../../../../lib/localStorageManager";
import { Text } from "@oldcord/frontend-shared/components/textComponent";
import PageInfo from "@oldcord/frontend-shared/components/pageInfo";
import Button from "@oldcord/frontend-shared/components/button";
import { useModal } from "@oldcord/frontend-shared/hooks/modalHandler";

const failedCacheKey = "oldcord_failed_urls";

export default function ({ isOpen, onClose }) {
  const { removeModal } = useModal();

  function removeCache() {
    const failedCaches = localStorageManager.get(failedCacheKey);

    if (failedCaches) {
      localStorageManager.remove(failedCacheKey);
    }

    removeModal();
  }
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reset Failed Chunk Cache?"
      size="medium"
      footer={
        <div className="button-group">
          <Button
            variant="ghost"
            onClick={() => {
              removeModal();
            }}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              removeCache();
            }}
          >
            Delete
          </Button>
        </div>
      }
    >
      <div style={{ paddingBottom: "20px", userSelect: "all" }}>
        <PageInfo title={"Deprecated option"} style={{ marginBottom: "20px" }}>
          This option will be removed once OPFS has been implemented to Oldcord,
          which will simplify the process with a on-demand download button.
        </PageInfo>
        <Text variant="body">
          This will clear the list of all previously failed chunk downloads,
          allowing the bootloader to retry downloading missing chunks from the
          CDN.
        </Text>
        <Text variant="body">Only use this if:</Text>
        <ul style={{ marginBottom: "20px" }}>
          <li>
            <Text variant="body">New chunks have been uploaded to the CDN</Text>
          </li>
          <li>
            <Text variant="body">
              You want to retry downloading previously unavailable chunks
            </Text>
          </li>
        </ul>
        <PageInfo style={{ marginBottom: "0px" }}>
          ⚠️ Warning: This will reset the failed chunk cache for ALL builds. The
          bootloader will attempt to redownload chunks that were previously
          marked as missing, which may slow down loading times if the chunks are
          still unavailable.
        </PageInfo>
      </div>
    </Modal>
  );
}
