import { useState } from 'react';

import contextFactory from '@oldcord/frontend-shared/hooks/contextFactory';

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
