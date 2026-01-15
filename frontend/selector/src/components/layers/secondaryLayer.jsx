import { useEffect, useRef } from 'react';

import UnsavedChangesNotice from '@oldcord/frontend-shared/components/unsavedChangesNotice';
import { useUnsavedChanges } from '@oldcord/frontend-shared/hooks/unsavedChangesHandler';

import { useLayer } from '../../hooks/layerHandler';
import ClosePart from './closePart';
import SidebarPart from './sidebarPart';

import './secondaryLayer.css';

export default function SecondaryLayer({ sidebarComponent, contentComponent }) {
  const { activeLayer, changeLayer } = useLayer();
  const { hasUnsavedChanges, onSave, onReset, displayRedNotice } = useUnsavedChanges();
  const isActive = activeLayer !== null;
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      const timer = setTimeout(() => {
        ref.current.classList.add('transitionToSecondaryLayer');
      }, 0);

      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (ref.current && !isActive) {
      ref.current.classList.remove('transitionToSecondaryLayer');
    }
  }, [activeLayer]);

  function onClose() {
    changeLayer('primary');
  }

  return (
    <div className="secondary-layer" ref={ref}>
      <SidebarPart>{sidebarComponent}</SidebarPart>
      <div className="content-part">
        <div className="scroller-wrapper">
          <div className="scroller">
            <div className="content-view">{contentComponent}</div>
            <ClosePart onClose={onClose} />
          </div>
        </div>
        <UnsavedChangesNotice
          show={hasUnsavedChanges}
          onSave={onSave}
          onReset={onReset}
          displayRedNotice={displayRedNotice}
        />
      </div>
    </div>
  );
}
