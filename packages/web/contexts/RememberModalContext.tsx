"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { RememberModal } from "@/components/remember/RememberModal";

interface RememberModalCtx {
  openRememberModal: () => void;
}

const Ctx = createContext<RememberModalCtx>({ openRememberModal: () => {} });

export const useRememberModal = () => useContext(Ctx);

export function RememberModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <Ctx.Provider value={{ openRememberModal: () => setOpen(true) }}>
      {children}
      <RememberModal open={open} onClose={() => setOpen(false)} />
    </Ctx.Provider>
  );
}
