import type { ButtonHTMLAttributes } from "react";

export type PushButtonVariant = "primary" | "secondary" | "ghost";

type PushButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: PushButtonVariant;
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

/**
 * Tactile 3D push button. The thick bottom border is the "depth"; on press it
 * shrinks by 2px while the button translates down 2px, and a 2px bottom margin
 * compensates so surrounding layout doesn't shift.
 */
export function PushButton({
  variant = "primary",
  fullWidth = false,
  className = "",
  type = "button",
  ...props
}: PushButtonProps) {
  return (
    <button
      type={type}
      className={[
        "inline-flex select-none items-center justify-center gap-2 rounded-xl border-b-4 px-5 py-3",
        "text-base font-bold tracking-wide",
        "transition-[transform,background-color,filter] duration-75 motion-reduce:transition-none",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
        "enabled:active:mb-[2px] enabled:active:translate-y-[2px] enabled:active:border-b-2",
        "disabled:cursor-not-allowed disabled:opacity-60",
        fullWidth ? "w-full" : "",
        VARIANT_CLASSES[variant],
        className,
      ].join(" ")}
      {...props}
    />
  );
}
