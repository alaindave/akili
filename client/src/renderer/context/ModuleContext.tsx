import { createContext, useContext, type ReactNode } from "react";

export type AppModule =
  | "HR"
  | "INVENTORY"
  | "PROCUREMENT"
  | "PRODUCTION"
  | "SALES"
  | "ACCOUNTING";

interface ModuleContextValue {
  module: AppModule;
}

const ModuleContext = createContext<ModuleContextValue | undefined>(undefined);

interface ModuleProviderProps {
  module: AppModule;
  children: ReactNode;
}

export function ModuleProvider({ module, children }: ModuleProviderProps) {
  return (
    <ModuleContext.Provider value={{ module }}>
      {children}
    </ModuleContext.Provider>
  );
}

export function useModule(): ModuleContextValue {
  const context = useContext(ModuleContext);

  if (!context) {
    throw new Error("useModule must be used inside a ModuleProvider");
  }

  return context;
}
