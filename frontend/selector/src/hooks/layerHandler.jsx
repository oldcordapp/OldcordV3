import { createContext, useState, useContext, useEffect } from 'react';

const Context = createContext();

export function LayerHandler({ children }) {
  const [activeLayer, setActiveLayer] = useState(null);

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

    if (layer == 'primary') {
      setActiveLayer(null);
    } else {
      setActiveLayer(layer);
    }
  }

  const value = {
    activeLayer,
    triggeredRedirect,
    exitingLayer,
    changeLayer,
    setTriggeredRedirect,
  };

  return <Context value={value}>{children}</Context>;
}

export function useLayer() {
  return useContext(Context);
}
