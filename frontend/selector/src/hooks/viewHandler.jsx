import contextFactory from '@oldcord/frontend-shared/hooks/contextFactory';
import { useState } from 'react';

export default function ({ views, defaultView }) {
  function useViewState() {
    const [activeView, setActiveView] = useState(defaultView);

    function changeView(view) {
      setActiveView(view);
    }

    return {
      activeView,
      changeView,
      views,
    };
  }

  return contextFactory(useViewState);
}
