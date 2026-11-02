// Demo: 8 shots of 1 s, one transition on each cut. Flat shapes on purpose, so you see the motion, not the footage.
import React from "react";
import { AbsoluteFill, Composition, Series } from "remotion";
import { SnapTransitions, type Cut } from "../src";

const SHOT = 30;
const SHOTS: { label: string; bg: string }[] = [
  { label: "cut", bg: "#1d47f5" },
  { label: "flash", bg: "#e8453c" },
  { label: "flash-full", bg: "#1f9d6b" },
  { label: "whip", bg: "#f2a516" },
  { label: "mirror-slide", bg: "#7a3cf0" },
  { label: "zoom-blur", bg: "#0e8fa8" },
  { label: "bullet", bg: "#d23c8a" },
  { label: "vhs", bg: "#333a48" },
];
const CUTS: Cut[] = SHOTS.slice(1).map((s, i) => ({ frame: (i + 1) * SHOT, type: s.label as Cut["type"] }));

const Shot: React.FC<{ label: string; bg: string }> = ({ label, bg }) => (
  <AbsoluteFill style={{ background: bg, alignItems: "center", justifyContent: "center" }}>
    <AbsoluteFill style={{ background: "repeating-linear-gradient(45deg, rgba(255,255,255,0.12) 0 40px, transparent 40px 80px)" }} />
    <div style={{ width: 300, height: 300, borderRadius: 40, border: "18px solid white", position: "absolute", left: 120, top: 210 }} />
    <div style={{ fontFamily: "Arial Black, Arial, sans-serif", fontSize: 120, color: "white", letterSpacing: -2 }}>{label}</div>
  </AbsoluteFill>
);

const Demo: React.FC = () => (
  <SnapTransitions cuts={CUTS}>
    <Series>
      {SHOTS.map((s) => (
        <Series.Sequence key={s.label} durationInFrames={SHOT}>
          <Shot {...s} />
        </Series.Sequence>
      ))}
    </Series>
  </SnapTransitions>
);

export const Root: React.FC = () => <Composition id="Demo" component={Demo} durationInFrames={SHOTS.length * SHOT} fps={30} width={1280} height={720} />;
