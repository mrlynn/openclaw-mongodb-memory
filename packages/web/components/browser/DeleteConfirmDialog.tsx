"use client";

import { useState } from "react";
import ConfirmationModal from "@leafygreen-ui/confirmation-modal";
import TextInput from "@leafygreen-ui/text-input";
import { useThemeMode } from "@/contexts/ThemeContext";

interface DeleteConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  requireConfirmText?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function DeleteConfirmDialog({
  open,
  title,
  description,
  requireConfirmText = false,
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps) {
  const { darkMode } = useThemeMode();
  const [confirmInput, setConfirmInput] = useState("");
  const [loading, setLoading] = useState(false);

  const canConfirm = requireConfirmText ? confirmInput === "CONFIRM" : true;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
      setConfirmInput("");
    }
  };

  const handleCancel = () => {
    setConfirmInput("");
    onCancel();
  };

  return (
    <ConfirmationModal
      open={open}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      title={title}
      buttonText={loading ? "Deleting..." : "Delete"}
      variant="danger"
      submitDisabled={!canConfirm || loading}
      darkMode={darkMode}
    >
      <p style={{ marginBottom: requireConfirmText ? 16 : 0, opacity: 0.8 }}>
        {description}
      </p>
      {requireConfirmText && (
        <TextInput
          label='Type "CONFIRM" to proceed'
          value={confirmInput}
          onChange={(e) => setConfirmInput(e.target.value)}
          darkMode={darkMode}
        />
      )}
    </ConfirmationModal>
  );
}
