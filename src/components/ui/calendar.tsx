import React, { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  mode?: "single";
  selected?: Date;
  onSelect?: (date?: Date) => void;
  renderDay?: (day: Date) => React.ReactNode;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function Calendar({ selected, onSelect, renderDay }: Props) {
  const initial = selected ? new Date(selected) : new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  // selectedが変わったら表示月も追従（UX良くする）
  React.useEffect(() => {
    if (!selected) return;
    setViewYear(selected.getFullYear());
    setViewMonth(selected.getMonth());
  }, [selected?.getFullYear(), selected?.getMonth()]);

  const monthLabel = useMemo(() => {
    const d = new Date(viewYear, viewMonth, 1);
    return `${d.getFullYear()}年 ${d.getMonth() + 1}月`;
  }, [viewYear, viewMonth]);

  const days = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const firstDow = first.getDay(); // 0:日
    const gridStart = new Date(viewYear, viewMonth, 1 - firstDow);

    const out: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      out.push(startOfDay(d));
    }
    return out;
  }, [viewYear, viewMonth]);

  const goPrev = () => {
    const d = new Date(viewYear, viewMonth - 1, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };
  const goNext = () => {
    const d = new Date(viewYear, viewMonth + 1, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const weekLabels = ["日", "月", "火", "水", "木", "金", "土"];

  return (
    <div className="rounded-xl border bg-white p-3">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={goPrev}
          className="h-9 px-3 rounded-lg border bg-white hover:bg-gray-50 text-sm"
        >
          ←
        </button>
        <div className="font-semibold text-gray-800">{monthLabel}</div>
        <button
          type="button"
          onClick={goNext}
          className="h-9 px-3 rounded-lg border bg-white hover:bg-gray-50 text-sm"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 mb-1">
        {weekLabels.map((w) => (
          <div key={w} className={cn(w === "日" && "text-rose-500", w === "土" && "text-blue-500")}>
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const inMonth = d.getMonth() === viewMonth;
          const isSelected = selected ? isSameDay(d, startOfDay(selected)) : false;

          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => onSelect?.(d)}
              className={cn(
                "h-16 rounded-lg border bg-white hover:bg-gray-50 flex items-center justify-center",
                !inMonth && "opacity-40",
                isSelected && "ring-2 ring-indigo-300 border-indigo-200"
              )}
            >
              {renderDay ? renderDay(d) : <span className="text-sm">{d.getDate()}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
