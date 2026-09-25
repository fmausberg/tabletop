"use client";

import { useRef, useState, useTransition } from "react";

export function useBoardFeedback() {
  const [pending, startTransition] = useTransition();
  const saving = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  function clear() {
    setError(null);
    setMessage("");
  }

  function run(action: () => Promise<void>) {
    if (saving.current) return;
    saving.current = true;
    startTransition(async () => {
      try { await action(); }
      finally { saving.current = false; }
    });
  }

  return { pending, saving, error, message, setError, setMessage, clear, run };
}

export type BoardFeedback = ReturnType<typeof useBoardFeedback>;
