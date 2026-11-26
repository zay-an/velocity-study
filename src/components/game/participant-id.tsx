"use client";

import { Suspense, use, useState } from "react";
import { browser } from "react-dom";
import { UserRound, UserX } from "lucide-react";
import { readStoredParticipantCode } from "@/lib/participant-storage";

const REASON = "The participant ID is stored in localStorage / a first-party cookie.";

function StoredParticipantChip() {
  use(browser(REASON));
  const [code] = useState(readStoredParticipantCode);

  if (!code) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-xl border-b-4 border-slate-950 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300">
        <UserX aria-hidden className="size-4" />
        No participant
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-xl border-b-4 border-slate-950 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300"
      aria-label={`Active participant ${code}`}
    >
      <UserRound aria-hidden className="size-4 text-emerald-400" />
      <span className="font-mono text-sm font-bold text-emerald-300">{code}</span>
    </span>
  );
}

/** Shows the active `P-XXXX` participant code saved on this device by the /auth flow. */
export function ParticipantChip() {
  return (
    <Suspense
      fallback={
        <span
          aria-hidden
          className="inline-block h-8 w-24 rounded-xl border-b-4 border-slate-950 bg-slate-800"
        />
      }
    >
      <StoredParticipantChip />
    </Suspense>
  );
}

function StoredParticipantNote() {
  use(browser(REASON));
  const [code] = useState(readStoredParticipantCode);
  return code ? (
    <>
      Recording as <span className="font-mono font-bold text-emerald-300">{code}</span>
    </>
  ) : (
    <>
      No participant signed in. Runs will be labeled{" "}
      <span className="font-mono font-bold text-slate-100">anonymous</span>.
    </>
  );
}

/** Inline sentence describing which participant this device's runs are recorded under. */
export function ParticipantNote() {
  return (
    <Suspense fallback={<>Checking participant…</>}>
      <StoredParticipantNote />
    </Suspense>
  );
}
