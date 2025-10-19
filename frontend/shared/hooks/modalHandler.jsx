import contextFactory from "@oldcord/frontend-shared/hooks/contextFactory";
import { useState, useCallback, useRef } from "react";

function useModalState() {
  const [modal, setModal] = useState({ name: null, props: {} });
  const [isExiting, setIsExiting] = useState(false);
  const exitResolve = useRef(null);

  const addModal = useCallback((name, props = {}) => {
    return new Promise((resolve) => {
      setModal({ name, props: { ...props, resolve } });
      setIsExiting(false);
    });
  }, []);

  const removeModal = useCallback(() => {
    if (!modal.name) return Promise.resolve();

    setIsExiting(true);

    return new Promise((resolve) => {
      exitResolve.current = resolve;
    });
  }, [modal.name]);

  const onModalExited = useCallback(() => {
    if (exitResolve.current) {
      exitResolve.current();
      exitResolve.current = null;
    }

    if (modal.props?.resolve) {
      modal.props.resolve();
    }

    setModal({ name: null, props: {} });
    setIsExiting(false);
  }, [modal.props]);

  return {
    activeModal: modal.name,
    isExiting,
    modalProps: modal.props,
    addModal,
    removeModal,
    onModalExited,
  };
}

const { Provider, useContextHook } = contextFactory(useModalState);

export const ModalHandler = Provider;
export const useModal = useContextHook;
