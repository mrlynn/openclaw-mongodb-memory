"use client";

import Modal from "@leafygreen-ui/modal";
import { useThemeMode } from "@/contexts/ThemeContext";
import { RememberForm } from "./RememberForm";

interface RememberModalProps {
  open: boolean;
  onClose: () => void;
}

export function RememberModal({ open, onClose }: RememberModalProps) {
  const { darkMode } = useThemeMode();

  return (
    <Modal open={open} setOpen={(v) => !v && onClose()} darkMode={darkMode}>
      <RememberForm />
    </Modal>
  );
}
