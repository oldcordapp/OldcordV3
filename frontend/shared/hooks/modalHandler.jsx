import contextFactory from "@oldcord/frontend-shared/hooks/contextFactory";
import { useState, useEffect } from "react";

function useModalState() {
  const [activeModal, setActiveModal] = useState(null);

  const [exitingModal, setExitingModal] = useState(null);
  const [exitDuration, setExitDuration] = useState(null);

  useEffect(() => {
    if (exitingModal) {
      const timer = setTimeout(() => {
        setExitingModal(null);
      }, exitDuration);

      return () => clearTimeout(timer);
    }
  }, [exitingModal]);

  function removeModal(exitDuration = 300) {
    setExitingModal(activeModal);
    setExitDuration(exitDuration);

    setActiveModal(null);
  }

  return {
    activeModal,
    exitingModal,
    setActiveModal,
    removeModal,
  };
}

const { Provider, useContextHook } = contextFactory(useModalState);

export const ModalHandler = Provider;
export const useModal = useContextHook;
