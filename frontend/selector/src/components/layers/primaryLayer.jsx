import './primaryLayer.css';
import { useLayer } from '../../hooks/layerHandler';
import Selector from '../views/selector/main';
import { useEffect, useRef } from 'react';

export default function () {
  const { activeLayer } = useLayer();
  const isActive = activeLayer === null;
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      if (!isActive) {
        ref.current.classList.add('transitionToSecondaryLayer');
      } else {
        ref.current.classList.remove('transitionToSecondaryLayer');
      }
    }
  }, [activeLayer]);

  return (
    <div className={`primary-layer`} ref={ref}>
      <Selector />
    </div>
  );
}
