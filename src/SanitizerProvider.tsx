import React, { createContext, useContext } from 'react';
import { ISanitizer } from '@jupyterlab/apputils';

type SanitizerState = {
  sanitizer?: ISanitizer;
};

const SanitizerContext = createContext<SanitizerState | undefined>(undefined);

// Create a provider for components to consume and subscribe to changes
export function SanitizerProvider({
  sanitizer,
  children
}: {
  sanitizer?: ISanitizer;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <SanitizerContext.Provider value={{ sanitizer }}>
      {children}
    </SanitizerContext.Provider>
  );
}

export function useSanitizer(): SanitizerState {
  return useContext(SanitizerContext) ?? {};
}
