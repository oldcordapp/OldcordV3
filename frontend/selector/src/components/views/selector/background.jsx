import './background.css';

import { useRef } from 'react';

export default function () {
  const ref = useRef(null);

  function handleEntered() {
    if (ref.current) {
      ref.current.classList.add('entered');
    }
  }

  return (
    <div className="background-container">
      <div className={`background-img`} ref={ref} onAnimationEnd={handleEntered} />
    </div>
  );
}
