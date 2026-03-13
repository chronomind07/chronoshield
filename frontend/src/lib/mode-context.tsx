"use client";

import { createContext, useContext } from "react";

export interface ModeContextType {
  techMode: boolean;
  setTechMode: (v: boolean) => void;
}

export const ModeContext = createContext<ModeContextType>({
  techMode: true,
  setTechMode: () => {},
});

export function useTechMode() {
  return useContext(ModeContext);
}
