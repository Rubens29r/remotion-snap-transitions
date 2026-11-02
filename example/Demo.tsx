// Demo: an opening card, then one shot per transition. Every shot keeps moving (drifting shapes, slow push-in, text
// that snaps in) so the cuts read like a real edit. Graphics only, no footage.
import { loadFont } from "@remotion/google-fonts/Inter";
import React from "react";
import { AbsoluteFill, Composition, Easing, Series, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SnapTransitions, type Cut, type SnapType } from "../src";

const { fontFamily } = loadFont("normal", { weights: ["500", "900"], subsets: ["latin"] });
const SHOT = 36;

type Shot = { title: string; info: string; from: string; to: string; type?: SnapType };
const SHOTS: Shot[] = [
  { title: "snap", info: "7 fast cut transitions for Remotion", from: "#0b1020", to: "#1d47f5" },
  { title: "flash", info: "2 frames · a punchline", from: "#ff5f45", to: "#ff2d6f", type: "flash" },
  { title: "flash-full", info: "5 frames · a new chapter", from: "#13c08a", to: "#0a7d6b", type: "flash-full" },
  { title: "whip", info: "1 + 3 frames · a topic switch", from: "#ffb21e", to: "#ff6a00", type: "whip" },
  { title: "mirror-slide", info: "12 frames · moving on", from: "#8a4dff", to: "#4b1fd1", type: "mirror-slide" },
  { title: "zoom-blur", info: "8 frames · into a detail", from: "#16b6d9", to: "#0d5fa8", type: "zoom-blur" },
  { title: "bullet", info: "6 frames · up / down energy", from: "#ff4fb4", to: "#b0137a", type: "bullet" },
  { title: "vhs", info: "12 frames · a flashback", from: "#2a3242", to: "#0d1118", type: "vhs" },
];
const CUTS: Cut[] = SHOTS.flatMap((s, i) => (s.type ? [{ frame: i * SHOT, type: s.type }] : []));

const ShotCard: React.FC<{ shot: Shot; index: number }> = ({ shot, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // The title is already on screen at the cut (the transition must show it), then settles.
  const pop = spring({ frame: frame + 4, fps, config: { damping: 14, stiffness: 220 } });
  const line = spring({ frame: frame - 3, fps, config: { damping: 18, stiffness: 180 } });
  const push = interpolate(frame, [0, SHOT], [1, 1.06], { easing: Easing.out(Easing.quad) });
  const drift = frame * 2.2;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(${135 + frame}deg, ${shot.from}, ${shot.to})`, overflow: "hidden", fontFamily }}>
      <AbsoluteFill style={{ transform: `scale(${push})` }}>
        {/* Moving shapes: they make the motion blur and the mirrored edges visible. */}
        <div style={{ position: "absolute", width: 420, height: 420, borderRadius: "50%", border: "26px solid rgba(255,255,255,0.18)", left: 760 + Math.sin(frame / 9) * 30, top: -90 + drift }} />
        <div style={{ position: "absolute", width: 160, height: 160, borderRadius: 36, background: "rgba(255,255,255,0.14)", left: 80 + drift * 1.6, top: 470, transform: `rotate(${frame * 3}deg)` }} />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} style={{ position: "absolute", width: 14, height: 14, borderRadius: 7, background: "rgba(255,255,255,0.55)", left: 160 + i * 230 - drift * (0.6 + i * 0.15), top: 120 + ((i * 97) % 420) }} />
        ))}
        <AbsoluteFill style={{ justifyContent: "center", paddingLeft: 110 }}>
          <div style={{ color: "white", fontWeight: 900, fontSize: index === 0 ? 210 : 150, letterSpacing: -6, lineHeight: 0.95, transform: `translateY(${(1 - pop) * 40}px) scale(${0.92 + 0.08 * pop})`, transformOrigin: "left center" }}>
            {shot.title}
          </div>
          <div style={{ marginTop: 18, color: "rgba(255,255,255,0.86)", fontWeight: 500, fontSize: 38, transform: `translateX(${(1 - line) * -30}px)`, opacity: line }}>{shot.info}</div>
        </AbsoluteFill>
      </AbsoluteFill>
      {/* Progress dots, outside the push-in so they stay still. */}
      <div style={{ position: "absolute", left: 110, bottom: 56, display: "flex", gap: 12 }}>
        {SHOTS.map((_, i) => (
          <div key={i} style={{ width: i === index ? 40 : 12, height: 12, borderRadius: 6, background: i === index ? "white" : "rgba(255,255,255,0.35)" }} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

const Demo: React.FC = () => (
  <SnapTransitions cuts={CUTS}>
    <Series>
      {SHOTS.map((s, i) => (
        <Series.Sequence key={s.title} durationInFrames={SHOT}>
          <ShotCard shot={s} index={i} />
        </Series.Sequence>
      ))}
    </Series>
  </SnapTransitions>
);

export const Root: React.FC = () => <Composition id="Demo" component={Demo} durationInFrames={SHOTS.length * SHOT} fps={30} width={1280} height={720} />;
