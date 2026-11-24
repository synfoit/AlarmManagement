import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Siren, X } from 'lucide-react';

import type { RootState } from '../app/store';
import type { CriticalAlarm } from '../features/lib/criticalAlarmModels';

// Fakt "navi" alarm j toast banave (history merge thayeli juni alarms nahi)
const FRESH_WINDOW_MS = 10_000;
const AUTO_DISMISS_MS = 6_000;
const MAX_TOASTS = 3;

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function ToastItem({
  alarm,
  onOpen,
  onClose,
}: {
  alarm: CriticalAlarm;
  onOpen: (alarm: CriticalAlarm) => void;
  onClose: (id: string) => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(
      () => onClose(String(alarm.id)),
      AUTO_DISMISS_MS
    );
    return () => window.clearTimeout(timer);
  }, [alarm.id, onClose]);

  return (
    <div
      role="alert"
      className="critical-toast-in pointer-events-auto flex w-[380px] max-w-[92vw] items-start gap-3 rounded-md border border-red-200 border-l-4 border-l-red-600 bg-white px-3 py-2.5 shadow-xl"
    >
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50">
        <Siren size={16} className="text-red-600" />
      </div>

      <button
        type="button"
        onClick={() => onOpen(alarm)}
        className="min-w-0 flex-1 text-left"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[12px] font-semibold text-red-700">
            New Critical Alarm
          </span>
          <span className="shrink-0 text-[10px] text-slate-400">
            {formatTime(alarm.eventTimestamp)}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[12px] font-semibold text-slate-800">
          {alarm.sourceName}
        </p>
        <p className="truncate text-[12px] text-slate-500">{alarm.message}</p>
      </button>

      <button
        type="button"
        onClick={() => onClose(String(alarm.id))}
        aria-label="Dismiss"
        className="shrink-0 rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default function CriticalAlarmToast({
  onOpen,
}: {
  onOpen: (alarm: CriticalAlarm) => void;
}) {
  const alarms = useSelector((state: RootState) => state.criticalAlarms.alarms);

  const seenIds = useRef<Set<string> | null>(null);
  const [toasts, setToasts] = useState<CriticalAlarm[]>([]);

  useEffect(() => {
    // First run: jetli alarms pehla thi store ma chhe te seen gano, toast nahi
    if (seenIds.current === null) {
      seenIds.current = new Set(alarms.map((a) => String(a.id)));
      return;
    }

    const seen = seenIds.current;
    const unseen = alarms.filter((a) => !seen.has(String(a.id)));
    if (unseen.length === 0) return;

    unseen.forEach((a) => seen.add(String(a.id)));

    const fresh = unseen.filter(
      (a) => Date.now() - Date.parse(a.receivedAt) < FRESH_WINDOW_MS
    );
    if (fresh.length === 0) return;

    setToasts((prev) => [...fresh, ...prev].slice(0, MAX_TOASTS));
  }, [alarms]);

  const handleClose = (id: string) =>
    setToasts((prev) => prev.filter((t) => String(t.id) !== id));

  const handleOpen = (alarm: CriticalAlarm) => {
    handleClose(String(alarm.id));
    onOpen(alarm);
  };

  if (toasts.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes critical-toast-in {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .critical-toast-in { animation: critical-toast-in 0.25s ease-out; }
      `}</style>

      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col-reverse items-end gap-2">
        {toasts.map((alarm) => (
          <ToastItem
            key={alarm.id}
            alarm={alarm}
            onOpen={handleOpen}
            onClose={handleClose}
          />
        ))}
      </div>
    </>
  );
}
