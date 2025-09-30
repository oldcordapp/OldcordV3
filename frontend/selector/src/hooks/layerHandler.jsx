import { createContext, useState, useContext } from "react";

const Context = createContext();

export function LayerHandler({ children }) {
  const [activeLayer, setActiveLayer] = useState(null);

  const [activeModals, setActiveModals] = useState([]);

  const [activeNotifs, setActiveNotifs] = useState([]);

  function changeLayer(layer) {
    if ((layer = "main")) {
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
    changeLayer,
    addModal,
    removeModal,
    addNotif
  };

  return <Context value={value}>{children}</Context>;
}

export function useLayer() {
  return useContext(Context);
}
