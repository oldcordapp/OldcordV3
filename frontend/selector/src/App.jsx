import { LayerHandler, useLayer } from "./hooks/layerHandler";
import {
  UnsavedChangesHandler,
  useUnsavedChanges,
} from "@oldcord/frontend-shared/hooks/unsavedChangesHandler";
import {
  ModalHandler,
  useModal,
} from "@oldcord/frontend-shared/hooks/modalHandler";
import { useEffect, useRef } from "react";

import layerConfig from "./components/layerConfig";
import modalConfig from "./components/modalConfig";

import PrimaryLayer from "./components/layers/primaryLayer";
import "./App.css";

function Container() {
  const { activeLayer, exitingLayer, triggeredRedirect } = useLayer();
  const { isNudging } = useUnsavedChanges();
  const { activeModal, exitingModal, modalProps, removeModal } = useModal();
  const ref = useRef(null);

  useEffect(() => {
    let intervalId;
    if (isNudging) {
      intervalId = setInterval(() => {
        if (ref.current) {
          const randomY = Math.random() * 30 - 15;
          const randomX = Math.random() < 0.5 ? 15 : -15;
          ref.current.style.transform = `translate3d(${randomX}px, ${randomY}px, 0)`;
        }
      }, 10);
    } else if (ref.current) {
      ref.current.style.transform = "";
    }
    return () => clearInterval(intervalId);
  }, [isNudging]);

  useEffect(() => {
    if (triggeredRedirect) {
      window.location = `${location.protocol}//${location.host}`;
    }
  }, [triggeredRedirect])

  const layerKey = activeLayer || exitingLayer;
  const CurrentLayer = layerKey ? layerConfig[layerKey]?.Component : null;

  const modalKey = activeModal || exitingModal;
  const CurrentModal = modalKey ? modalConfig[modalKey]?.Component : null;

  return (
    <div ref={ref}>
      <PrimaryLayer />
      {CurrentLayer && <CurrentLayer />}

      {CurrentModal && (
        <CurrentModal
          {...modalProps}
          onClose={() => {
            removeModal();
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <LayerHandler>
      <UnsavedChangesHandler>
        <ModalHandler>
          <Container />
        </ModalHandler>
      </UnsavedChangesHandler>
    </LayerHandler>
  );
}
