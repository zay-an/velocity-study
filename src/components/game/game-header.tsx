"use client";

import Link from "next/link";
import { LogIn, Volume2, VolumeX, Zap } from "lucide-react";
import { PushButton, pushButtonClassName } from "@/components/ui/push-button";
import { ParticipantChip } from "./participant-id";
import { useGameStore } from "./use-game-store";

export function GameHeader() {
  const phase = useGameStore((s) => s.phase);
  const muted = useGameStore((s) => s.muted);
  const hasHydrated = useGameStore((s) => s.hasHydrated);
  const toggleMute = useGameStore((s) => s.toggleMute);
  const returnToLobby = useGameStore((s) => s.returnToLobby);

  return (
    <header className="relative z-20 border-b-4 border-slate-950 bg-slate-800/80 backdrop-blur">
      <nav
        aria-label="Main"
        className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6"
      >
        <button
          type="button"
          onClick={() => {
            if (phase !== "playing") returnToLobby();
          }}
          className="flex items-center gap-2 rounded-lg text-base font-black tracking-tight text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
          aria-label="VelocityStudy home"
        >
          <span className="flex size-8 items-center justify-center rounded-lg border-b-4 border-emerald-700 bg-emerald-500 text-slate-950">
            <Zap aria-hidden className="size-4" strokeWidth={2.5} />
          </span>
          <span className="hidden sm:inline">VelocityStudy</span>
        </button>

        <div className="flex items-center gap-2 sm:gap-3">
          <ParticipantChip />
          <PushButton
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            aria-pressed={muted}
            aria-label={muted ? "Unmute sound (M)" : "Mute sound (M)"}
            title={muted ? "Unmute (M)" : "Mute (M)"}
            className={hasHydrated ? "opacity-100" : "opacity-0"}
          >
            {muted ? <VolumeX aria-hidden className="size-5" /> : <Volume2 aria-hidden className="size-5" />}
          </PushButton>
          <Link
            href="/auth"
            aria-label="Sign In / Switch Participant"
            className={pushButtonClassName({ variant: "secondary", size: "sm" })}
          >
            <LogIn aria-hidden className="size-4" />
            <span className="sm:hidden">Sign In</span>
            <span className="hidden sm:inline">Sign In / Switch Participant</span>
          </Link>
        </div>
      </nav>
    </header>
  );
}
