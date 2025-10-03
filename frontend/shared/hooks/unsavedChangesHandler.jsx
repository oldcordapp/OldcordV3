  import contextFactory from "./contextFactory";
  import { useState, useCallback, useRef } from "react";

  function useUnsavedChangesState() {
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isNudging, setIsNudging] = useState(false);
    const [displayRedNotice, setDisplayRedNotice] = useState(false);
    const handlersRef = useRef({ onSave: () => {}, onReset: () => {} });

    const registerHandlers = useCallback((onSave, onReset) => {
      handlersRef.current.onSave = onSave;
      handlersRef.current.onReset = onReset;
    }, []);

    const onSave = useCallback(() => {
      handlersRef.current.onSave();
    }, []);

    const onReset = useCallback(() => {
      handlersRef.current.onReset();
    }, []);

    const triggerNudge = useCallback(() => {
      if (hasUnsavedChanges) {
        setIsNudging(true);
        setDisplayRedNotice(true);
        setTimeout(() => setIsNudging(false), 300);
        setTimeout(() => setDisplayRedNotice(false), 1000);
      }
    }, [hasUnsavedChanges]);

    return {
      hasUnsavedChanges,
      setHasUnsavedChanges,
      onSave,
      onReset,
      registerHandlers,
      isNudging,
      displayRedNotice,
      triggerNudge,
    };
  }

  const { Provider, useContextHook } = contextFactory(useUnsavedChangesState);

  export const UnsavedChangesHandler = Provider;
  export const useUnsavedChanges = useContextHook;