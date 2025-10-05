import contextFactory from "@oldcord/frontend-shared/hooks/contextFactory";
import { useState, useEffect } from "react";

function useModalState() {
  const [modal, setModal] = useState({ name: null, props: {} });
  const [exitingModal, setExitingModal] = useState({ name: null, props: {} });
  const [exitDuration, setExitDuration] = useState(null);

  useEffect(() => {
    if (exitingModal.name) {
      const timer = setTimeout(() => {
        setExitingModal({ name: null, props: {} });
      }, exitDuration);

      return () => clearTimeout(timer);
    }
  }, [exitingModal.name]);

  function addModal(name, props = {}) {
    setModal({ name, props });
  }

  function removeModal(exitDuration = 300) {
    setExitingModal(modal);
    setExitDuration(exitDuration);
    setModal({ name: null, props: {} });
  }

  return {
    activeModal: modal.name,
    exitingModal: exitingModal.name,
    modalProps: modal.props,
    addModal,
    removeModal,
  };
}

const { Provider, useContextHook } = contextFactory(useModalState);

export const ModalHandler = Provider;
export const useModal = useContextHook;
