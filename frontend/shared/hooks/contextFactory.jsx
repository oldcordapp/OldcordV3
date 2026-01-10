import { createContext, useContext } from 'react';

export default function (useHook) {
  const Context = createContext(null);

  const Provider = ({ children }) => {
    const value = useHook();
    return <Context value={value}>{children}</Context>;
  };

  const useContextHook = () => {
    const context = useContext(Context);
    if (Context === null) {
      throw new Error('[Selector] useContextHook must be used within its Provider');
    }
    return context;
  };

  return { Provider, useContextHook };
}
