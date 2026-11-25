import type { Metadata } from "next";
import { AuthPanel } from "./auth-panel";

export const metadata: Metadata = {
  title: "Sign in · VelocityStudy",
  description: "Sign in to VelocityStudy or join instantly as a research participant.",
};

export default function AuthPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-slate-900 px-4 py-12 text-slate-100">
      <AuthPanel />
    </main>
  );
}
