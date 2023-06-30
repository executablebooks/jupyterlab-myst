import React, { createContext, useContext } from 'react';
import { ILatexTypesetter } from '@jupyterlab/rendermime';

type TypesetterState = {
  typesetter?: ILatexTypesetter;
};

const TypesetterContext = createContext<TypesetterState | undefined>(undefined);

// Create a provider for components to consume and subscribe to changes
export function TypesetterProvider({
  typesetter,
  children
}: {
  typesetter?: ILatexTypesetter;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <TypesetterContext.Provider value={{ typesetter }}>
      {children}
    </TypesetterContext.Provider>
  );
}

export function useTypesetter(): TypesetterState {
  return useContext(TypesetterContext) ?? {};
}
