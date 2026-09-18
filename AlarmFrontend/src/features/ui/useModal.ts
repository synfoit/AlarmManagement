import { useState, useCallback } from "react";

export function useModal<T>(defaultValues: Partial<T> = {}) {
  const [isOpen, setOpen] = useState(false);
  const [values, setValues] = useState<Partial<T>>(defaultValues);

  const open = useCallback((initial: Partial<T> = {}) => {
    setValues(initial);
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  return {
    isOpen,
    values,
    open,
    close,
  } as const;
}
