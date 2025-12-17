import React from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";

export function Calendar({
  mode = "single",
  selected,
  onSelect,
  renderDay
}: {
  mode?: "single";
  selected?: Date;
  onSelect?: (date?: Date) => void;
  renderDay?: (day: Date) => React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-white p-2">
      <DayPicker
        mode={mode}
        selected={selected}
        onSelect={onSelect}
        showOutsideDays
        components={{
          DayContent: (props) => {
            const d = props.date;
            return <>{renderDay ? renderDay(d) : d.getDate()}</>;
          }
        }}
      />
    </div>
  );
}
