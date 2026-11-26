import type { Metadata } from "next";
import { GameApp } from "@/components/game/game-app";

export const metadata: Metadata = {
  title: "VelocityStudy · Speed vs. Accuracy",
  description:
    "Interactive research prototype measuring how speed-based scoring affects answer accuracy.",
};

export default function Home() {
  return <GameApp />;
}
