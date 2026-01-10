import { useEffect, useRef } from 'react';

export default function () {
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
  }, []);

  return isMounted.current;
}
