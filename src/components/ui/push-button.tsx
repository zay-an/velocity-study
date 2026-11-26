import type { ButtonHTMLAttributes } from "react";

export type PushButtonVariant = "primary" | "secondary" | "ghost";
export type PushButtonSize = "sm" | "md" | "lg" | "icon";

type PushButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: PushButtonVariant;
  size?: PushButtonSize;
  fullWidth?: boolean;
};

// Text/background pairs are chosen to meet WCAG AA (>= 4.5:1) at body size.
const VARIANT_CLASSES: Record<PushButtonVariant, string> = {
  primary:
    "bg-emerald-500 text-slate-950 border-emerald-700 hover:bg-emerald-400 focus-visible:ring-emerald-300",
  secondary:
    "bg-indigo-600 text-white border-indigo-800 hover:brightness-110 focus-visible:ring-indigo-300",
  ghost:
    "bg-slate-800 text-slate-100 border-slate-950 hover:bg-slate-700 focus-visible:ring-slate-400",
};

const SIZE_CLASSES: Record<PushButtonSize, string> = {
  sm: "rounded-lg px-3 py-1.5 text-sm font-bold",
  md: "rounded-xl px-5 py-3 text-base font-bold tracking-wide",
  lg: "rounded-2xl px-10 py-4 text-xl font-black uppercase tracking-wide",
  icon: "size-10 rounded-xl p-0",
};

type PushButtonClassOptions = {
  variant?: PushButtonVariant;
  size?: PushButtonSize;
  fullWidth?: boolean;
  className?: string;
};

/**
 * Class list for the tactile push style. Exported so links (e.g. `next/link`)
 * can look identical to buttons without hand-rolling the styles.
 */
export function pushButtonClassName({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
}: PushButtonClassOptions = {}): string {
  return [
    "inline-flex select-none items-center justify-center gap-2 border-b-4",
    "transition-[transform,background-color,filter] duration-75 motion-reduce:transition-none",
    "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
    // `not-disabled:` lets the press effect apply to <a> as well as enabled <button>.
    "not-disabled:active:mb-[2px] not-disabled:active:translate-y-[2px] not-disabled:active:border-b-2",
    "disabled:cursor-not-allowed disabled:opacity-60",
    SIZE_CLASSES[size],
    fullWidth ? "w-full" : "",
    VARIANT_CLASSES[variant],
    className,
  ].join(" ");
}

/**
 * Tactile 3D push button. The thick bottom border is the "depth"; on press it
 * shrinks by 2px while the button translates down 2px, and a 2px bottom margin
 * compensates so surrounding layout doesn't shift.
 */
export function PushButton({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
  type = "button",
  ...props
}: PushButtonProps) {
  return (
    <button
      type={type}
      className={pushButtonClassName({ variant, size, fullWidth, className })}
      {...props}
    />
  );
}
