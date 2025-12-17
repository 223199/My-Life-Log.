import React from "react";

export function Checkbox({
  checked,
  onCheckedChange
}: {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      className="h-4 w-4 accent-emerald-600"
      checked={!!checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
    />
  );
}
