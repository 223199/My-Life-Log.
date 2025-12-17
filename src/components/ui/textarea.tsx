import React from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-[90px] w-full rounded-lg border p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-200",
        className
      )}
      {...props}
    />
  );
}
