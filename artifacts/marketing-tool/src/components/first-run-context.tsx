import { createContext, useContext } from 'react';

export const FirstRunContext = createContext({
  needsSetup: false,
  isFreshWorkspace: false,
  finishSetup: () => {},
});

export const useFirstRun = () => useContext(FirstRunContext);
