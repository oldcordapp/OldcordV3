import { createContext, useState, useContext, useEffect } from "react";

const Context = createContext();

export function LayerHandler({ children }) {
  const [activeLayer, setActiveLayer] = useState(null);

  const [activeModals, setActiveModals] = useState([]);

  const [activeNotifs, setActiveNotifs] = useState([]);

  const [triggeredRedirect, setTriggeredRedirect] = useState(false);

  const [exitingLayer, setExitingLayer] = useState(null);
  const [exitDuration, setExitDuration] = useState(null);

  useEffect(() => {
    if (exitingLayer) {
      const timer = setTimeout(() => {
        setExitingLayer(null);
      }, exitDuration);

      return () => clearTimeout(timer);
    }
  }, [exitingLayer]);

  function changeLayer(layer, exitDuration = 300) {
    setExitingLayer(activeLayer);
    setExitDuration(exitDuration);

    if (layer == "primary") {
      setActiveLayer(null);
    } else {
      setActiveLayer(layer);
    }
  }

  function addModal(modalType, data) {
    setActiveModals((currentModals) => {
      return [...currentModals, { type: modalType, data: data }];
    });
  }

  function removeModal() {
    setActiveModals((currentModals) => {
      currentModals.slice(0, 1);
    });
  }

  function addNotif(notifType, data) {
    setActiveNotifs((currentNotifs) => {
      return [...currentNotifs, { type: notifType, data: data }];
    });
  }

  const value = {
    activeLayer,
    activeModals,
    activeNotifs,
    triggeredRedirect,
    exitingLayer,
    changeLayer,
    addModal,
    removeModal,
    addNotif,
    setTriggeredRedirect,
  };

  return <Context value={value}>{children}</Context>;
}

export function useLayer() {
  return useContext(Context);
}
