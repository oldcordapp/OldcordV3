import { useLayer } from "../../hooks/layerHandler";

export default function () {
  const { activeModals } = useLayer();

  if (activeModals.length === 0) {
    return null;
  }

  const latestModal = activeModals[activeModals.length - 1];

  let modalComponent;
  switch (latestModal.type) {
    default:
      modalComponent = null;
  }

  return <div className="modal-layer">{modalComponent}</div>;
}
