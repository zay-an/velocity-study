"use client";

import { Suspense, use, useState, type FormEvent, type ReactNode } from "react";
import { browser } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, FlaskConical, LoaderCircle, Lock, Mail, User, Zap } from "lucide-react";
import { PushButton } from "@/components/ui/push-button";
import { createClient } from "@/lib/supabase/client";
import { signInSchema, signUpSchema } from "@/lib/auth-schema";
import { isParticipantCode } from "@/lib/participant-code";
import { readStoredParticipantCode, storeParticipantCode } from "@/lib/participant-storage";
import { sanitizeNextPath } from "@/lib/safe-redirect";

type Mode = "sign-in" | "sign-up";
type Pending = "idle" | "participant" | "email";
type Status = { kind: "error" | "info"; message: string } | null;

function currentNextPath(): string {
  return sanitizeNextPath(new URLSearchParams(window.location.search).get("next"));
}

function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/anonymous sign-ins are disabled/i.test(message)) {
    return "Participant mode isn't enabled yet. Enable Anonymous Sign-Ins in Supabase → Authentication → Providers.";
  }
  if (/invalid login credentials/i.test(message)) {
    return "That email and password don't match. Try again.";
  }
  if (/email not confirmed/i.test(message)) {
    return "Confirm your email first — check your inbox for the link.";
  }
  if (/already registered/i.test(message)) {
    return "An account with that email already exists. Sign in instead.";
  }
  return message || "Something went wrong. Please try again.";
}

function readField(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

export function AuthPanel() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [pending, setPending] = useState<Pending>("idle");
  const [status, setStatus] = useState<Status>(null);
  const busy = pending !== "idle";

  function finish() {
    router.replace(currentNextPath());
    router.refresh();
  }

  async function handleParticipantEntry() {
    setPending("participant");
    setStatus(null);
    const supabase = createClient();

    try {
      // Reuse an existing anonymous session so the participant keeps their ID.
      const { data: claimsData } = await supabase.auth.getClaims();
      let userId: string | null =
        claimsData?.claims.is_anonymous === true ? claimsData.claims.sub : null;

      if (userId === null) {
        const storedCode = readStoredParticipantCode();
        const { data, error } = await supabase.auth.signInAnonymously({
          options: { data: storedCode ? { participant_code: storedCode } : {} },
        });
        if (error) throw error;
        if (!data.user) throw new Error("Could not start a participant session.");
        userId = data.user.id;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("participant_code")
        .eq("id", userId)
        .single();
      if (profileError) throw profileError;
      if (!isParticipantCode(profile.participant_code)) {
        throw new Error("Participant ID was not assigned. Please try again.");
      }

      storeParticipantCode(profile.participant_code);
      finish();
    } catch (error) {
      setStatus({ kind: "error", message: describeError(error) });
      setPending("idle");
    }
  }

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus(null);

    const supabase = createClient();

    if (mode === "sign-in") {
      const parsed = signInSchema.safeParse({
        email: readField(form, "email"),
        password: readField(form, "password"),
      });
      if (!parsed.success) {
        setStatus({ kind: "error", message: parsed.error.issues[0]?.message ?? "Check your details." });
        return;
      }
      setPending("email");
      const { error } = await supabase.auth.signInWithPassword(parsed.data);
      if (error) {
        setStatus({ kind: "error", message: describeError(error) });
        setPending("idle");
        return;
      }
      finish();
      return;
    }

    const parsed = signUpSchema.safeParse({
      displayName: readField(form, "displayName"),
      email: readField(form, "email"),
      password: readField(form, "password"),
    });
    if (!parsed.success) {
      setStatus({ kind: "error", message: parsed.error.issues[0]?.message ?? "Check your details." });
      return;
    }
    setPending("email");
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", currentNextPath());

    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { display_name: parsed.data.displayName },
        emailRedirectTo: callback.toString(),
      },
    });
    if (error) {
      setStatus({ kind: "error", message: describeError(error) });
      setPending("idle");
      return;
    }
    if (data.session) {
      finish();
      return;
    }
    setStatus({
      kind: "info",
      message: `Check ${parsed.data.email} for a confirmation link to finish creating your account.`,
    });
    setPending("idle");
  }

  return (
    <div className="w-full max-w-md">
      <header className="mb-8 text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border-b-4 border-emerald-700 bg-emerald-500 text-slate-950">
          <Zap aria-hidden className="size-8" strokeWidth={2.5} />
        </div>
        <h1 className="text-3xl font-black tracking-tight text-white">VelocityStudy</h1>
        <p className="mt-2 text-slate-300">Fast answers. Real learning. Measured.</p>
      </header>

      <Suspense fallback={null}>
        <CallbackError />
      </Suspense>

      {/* One-click research participant entry */}
      <section
        aria-labelledby="participant-heading"
        className="rounded-2xl border-b-4 border-slate-950 bg-slate-800 p-6"
      >
        <div className="mb-4 flex items-start gap-3">
          <FlaskConical aria-hidden className="mt-0.5 size-6 shrink-0 text-emerald-400" />
          <div>
            <h2 id="participant-heading" className="text-lg font-bold text-white">
              Research participant
            </h2>
            <p className="text-sm text-slate-300">
              No email needed. You&apos;ll get an anonymous ID so your results stay private.
            </p>
            <Suspense fallback={null}>
              <ReturningParticipant />
            </Suspense>
          </div>
        </div>
        <PushButton
          variant="primary"
          fullWidth
          onClick={handleParticipantEntry}
          disabled={busy}
          aria-busy={pending === "participant"}
          className="py-4 text-lg"
        >
          {pending === "participant" ? (
            <LoaderCircle aria-hidden className="size-5 animate-spin motion-reduce:animate-none" />
          ) : (
            <ArrowRight aria-hidden className="size-5" />
          )}
          Start as participant
        </PushButton>
      </section>

      <div className="my-6 flex items-center gap-3 text-sm text-slate-400" role="separator">
        <span className="h-px flex-1 bg-slate-700" />
        or use an account
        <span className="h-px flex-1 bg-slate-700" />
      </div>

      {/* Email / password */}
      <section aria-label="Email account" className="rounded-2xl border-b-4 border-slate-950 bg-slate-800 p-6">
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-slate-950 p-1" role="group" aria-label="Account mode">
          {(["sign-in", "sign-up"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => {
                setMode(value);
                setStatus(null);
              }}
              className={[
                "rounded-lg py-2 text-sm font-bold transition-colors motion-reduce:transition-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300",
                mode === value ? "bg-slate-700 text-white" : "text-slate-300 hover:text-white",
              ].join(" ")}
            >
              {value === "sign-in" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        <form onSubmit={handleEmailSubmit} noValidate className="space-y-4">
          {mode === "sign-up" && (
            <Field
              id="displayName"
              label="Display name"
              type="text"
              autoComplete="nickname"
              icon={<User aria-hidden className="size-4" />}
              maxLength={40}
            />
          )}
          <Field
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            icon={<Mail aria-hidden className="size-4" />}
          />
          <Field
            id="password"
            label="Password"
            type="password"
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            icon={<Lock aria-hidden className="size-4" />}
            hint={mode === "sign-up" ? "At least 8 characters." : undefined}
          />
          <PushButton
            type="submit"
            variant="secondary"
            fullWidth
            disabled={busy}
            aria-busy={pending === "email"}
          >
            {pending === "email" && (
              <LoaderCircle aria-hidden className="size-5 animate-spin motion-reduce:animate-none" />
            )}
            {mode === "sign-in" ? "Sign in" : "Create account"}
          </PushButton>
        </form>
      </section>

      <div aria-live="polite" className="mt-4 min-h-6">
        {status && (
          <p
            role={status.kind === "error" ? "alert" : "status"}
            className={[
              "rounded-xl px-4 py-3 text-sm font-medium",
              status.kind === "error"
                ? "bg-rose-950 text-rose-200"
                : "bg-emerald-950 text-emerald-200",
            ].join(" ")}
          >
            {status.message}
          </p>
        )}
      </div>
    </div>
  );
}

/** Greets a returning participant using the ID stored on this device. */
function ReturningParticipant() {
  use(browser("The participant ID is stored in localStorage."));
  const [code] = useState(readStoredParticipantCode);
  if (!code) return null;
  return (
    <p className="mt-2 text-sm text-slate-300">
      Welcome back, <span className="font-mono font-bold text-emerald-300">{code}</span>
    </p>
  );
}

function CallbackError() {
  const searchParams = useSearchParams();
  if (searchParams.get("error") !== "confirmation_failed") return null;
  return (
    <p role="alert" className="mb-4 rounded-xl bg-rose-950 px-4 py-3 text-sm font-medium text-rose-200">
      That confirmation link is invalid or has expired. Sign in or request a new one.
    </p>
  );
}

type FieldProps = {
  id: string;
  label: string;
  type: "text" | "email" | "password";
  autoComplete: string;
  icon: ReactNode;
  hint?: string;
  maxLength?: number;
};

function Field({ id, label, type, autoComplete, icon, hint, maxLength }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-slate-200">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
          {icon}
        </span>
        <input
          id={id}
          name={id}
          type={type}
          autoComplete={autoComplete}
          maxLength={maxLength}
          aria-describedby={hintId}
          required
          className="w-full rounded-xl border-2 border-slate-700 bg-slate-950 py-2.5 pl-9 pr-3 text-slate-100 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
        />
      </div>
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-slate-400">
          {hint}
        </p>
      )}
    </div>
  );
}
