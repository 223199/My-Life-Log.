import React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "outline" | "ghost";
type Size = "default" | "sm";

export function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  const base =
    "inline-flex items-center justify-center rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed";
  const sizes = size === "sm" ? "h-8 px-3" : "h-10 px-4";
  const variants =
    variant === "outline"
      ? "border bg-white hover:bg-gray-50"
      : variant === "ghost"
      ? "hover:bg-gray-100"
      : "bg-indigo-600 text-white hover:bg-indigo-700";

  return <button className={cn(base, sizes, variants, className)} {...props} />;
}
