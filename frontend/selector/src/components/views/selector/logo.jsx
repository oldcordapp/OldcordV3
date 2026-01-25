import { useRef } from 'react';

import Logo from '../../../assets/logo.svg?react';

import './logo.css';

export default function () {
  const ref = useRef(null);

  function handleEntered() {
    if (ref.current) {
      ref.current.classList.remove('enter');
      ref.current.classList.remove('mounted');
    }
  }

  return (
    <a
      href='https://oldcordapp.com'
      className={`logo-container mounted enter`}
      onAnimationEnd={handleEntered}
      ref={ref}
    >
      <Logo className='logo-svg' />
    </a>
  );
}
