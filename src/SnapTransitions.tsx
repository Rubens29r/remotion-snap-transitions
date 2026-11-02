// Fast cut transitions for Remotion, measured frame by frame on hand-edited short-form videos: every value below
// (white levels, offsets, blur radii) was read off reference edits, not designed by eye. The whole picture moves like a
// camera ("everything inside <SnapTransitions> moves together"); titles placed outside it stay still.
import React, { useId } from "react";
import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from "remotion";

export type SnapType = "flash" | "flash-full" | "whip" | "mirror-slide" | "zoom-blur" | "bullet" | "vhs";
export type Direction = "left" | "right" | "up" | "down";
export type Cut = {
  /** Frame of the cut: the first frame of the next shot. */
  frame: number;
  type: SnapType;
  /** Frames of the effect (default: the measured length). Stretches or tightens both sides of the cut. */
  duration?: number;
  /** Multiplies every blur of the effect (1 = measured). */
  blur?: number;
  /** whip, mirror-slide: default left; bullet: default up. */
  direction?: Direction;
  /** flash, flash-full: white opacity frame by frame (flash: from the cut on). */
  whites?: number[];
};

type Look = { scale?: number; dx?: number; dy?: number; blur?: number; blurX?: number; blurY?: number; white?: number; mirror?: "x" | "y"; vhs?: number; seed?: string };

// Value of a frame-by-frame table that can be stretched (duration): the frames next to the cut keep their value, the
// tails get longer or shorter. before[i] = frame -1-i; after[i] = frame i.
function table(k: number, before: number[], after: number[], measured: number, duration?: number): number | undefined {
  const s = duration && duration > 0 ? measured / duration : 1;
  const read = (tab: number[], q: number) => {
    const i = Math.min(tab.length - 1, Math.floor(q));
    return i >= tab.length - 1 ? tab[tab.length - 1] : tab[i] + (tab[i + 1] - tab[i]) * (q - i);
  };
  const q = k < 0 ? (-k - 1) * s : k * s;
  const tab = k < 0 ? before : after;
  return q > tab.length - 1 + 1e-9 ? undefined : read(tab, q);
}

// The look of one cut at frame k relative to it (0 = first frame of the next shot, -1 = last frame of the previous one).
// Blurs are standard deviations in px for a 1080 x 1920 frame (scaled to the composition).
function lookAt(c: Cut, k: number, w: number, h: number): Look | null {
  const m = c.blur ?? 1;
  if (c.type === "flash") {
    // 2 white frames after the cut (0.79 then 0.59), nothing before, no zoom; duration 3 = a measured 0.69 / 0.62 / 0.27.
    const b = c.whites ?? (c.duration === 3 ? [0.69, 0.62, 0.27] : [0.79, 0.59]);
    return k >= 0 && k < b.length ? { white: b[k] } : null;
  }
  if (c.type === "flash-full") {
    // 5 frames 0.18 / 0.65 / 0.98 / 0.74 / 0.26: the cut falls under the brightest one (change of sequence).
    const b = c.whites ?? [0.18, 0.65, 0.98, 0.74, 0.26];
    const i = k + b.indexOf(Math.max(...b));
    return i >= 0 && i < b.length ? { white: b[i] } : null;
  }
  if (c.type === "mirror-slide") {
    // 12 frames: out -0.5 / -2.5 / -9.5 / -27 / -45 % of the width, in +29 / +10.5 / +3 / +1 / 0 %, mirrored edges, no
    // zoom; motion blur on 2 frames on each side of the cut.
    const dx = table(k, [-0.45, -0.27, -0.095, -0.025, -0.005, 0], [0.29, 0.105, 0.03, 0.01, 0, 0], 12, c.duration);
    if (dx === undefined) return null;
    return { dx: dx * w, blurX: (table(k, [9, 9, 0], [9, 9, 0], 12, c.duration) ?? 0) * m, mirror: "x" };
  }
  if (c.type === "zoom-blur") {
    // 8 frames: out x1.05 / x1.13 / x1.40, blurrier and blurrier; in blurred, sharp again in 5 frames, no zoom.
    const blur = table(k, [4.43, 2.89, 1.18], [3.17, 2.45, 1.48, 0.64, 0], 8, c.duration);
    if (blur === undefined) return null;
    return { scale: table(k, [1.4, 1.13, 1.05], [1], 8, c.duration) ?? 1, blur: blur * m };
  }
  if (c.type === "whip") {
    // 1 smeared frame (shifted -12.5 % of the width), then the next shot lands at x1.2 and settles to x1 in 3 frames.
    if (k === -1) return { dx: -0.125 * w, blurX: 3.58 * m, mirror: "x" };
    const settle = Math.max(1, (c.duration ?? 4) - 1);
    return k >= 0 && k < settle ? { scale: 1.2 - (0.2 * k) / settle } : null;
  }
  if (c.type === "bullet") {
    // Vertical: the previous shot flies up in 3 blurred frames, the next one enters from below in 2 (25 %, then 60 %
    // visible), 1 blurred frame in place, then sharp. Mirrored edges (top / bottom).
    const dy = table(k, [-0.75, -0.4, -0.15], [0.75, 0.4, 0], 6, c.duration);
    if (dy === undefined) return null;
    return { dy: dy * h, blurY: 10 * m, mirror: "y" };
  }
  if (c.type === "vhs") {
    // 12 frames (5 before the cut, 7 after): the picture jumps sideways (slightly enlarged so no edge shows), smeared,
    // colours pushed, tape noise on top; strongest on the first frame of the next shot.
    const force = table(k, [0.95, 0.7, 0.45, 0.25, 0.1], [1, 0.85, 0.6, 0.4, 0.22, 0.1, 0.04], 12, c.duration);
    if (force === undefined) return null;
    const seed = `vhs${c.frame}:${k}`;
    return { dx: (random(seed) - 0.5) * 0.05 * w * force, scale: 1 + 0.05 * force, blurX: 3 * force * m, vhs: force, seed };
  }
  return null;
}

// Turns a look towards `direction`: the travel along the base direction (left; up for the bullet) is moved to the new
// one, motion blur and mirrored edges included.
function orient(r: Look | null, c: Cut, w: number, h: number): Look | null {
  if (c.type !== "whip" && c.type !== "mirror-slide" && c.type !== "bullet") return r;
  const base: Direction = c.type === "bullet" ? "up" : "left";
  if (!r || !c.direction || c.direction === base) return r;
  const travel = base === "left" ? -(r.dx ?? 0) / w : -(r.dy ?? 0) / h;
  const blur = Math.max(r.blurX ?? 0, r.blurY ?? 0);
  const horizontal = c.direction === "left" || c.direction === "right";
  const sign = c.direction === "left" || c.direction === "up" ? -1 : 1;
  return {
    ...r, dx: horizontal ? sign * travel * w : 0, dy: horizontal ? 0 : sign * travel * h, blurX: horizontal ? blur : 0,
    blurY: horizontal ? 0 : blur, mirror: r.mirror ? (horizontal ? "x" : "y") : undefined,
  };
}

/** The combined camera of every cut at this frame. */
export function snapCamera(cuts: Cut[], frame: number, width: number, height: number) {
  const k0 = 1080 / Math.min(width, height); // blur radii were measured on 1080 px wide frames
  const cam = { scale: 1, dx: 0, dy: 0, blur: 0, blurX: 0, blurY: 0, white: 0, mirror: undefined as "x" | "y" | undefined, vhs: 0, seed: "" };
  for (const c of cuts) {
    const r = orient(lookAt(c, frame - c.frame, width, height), c, width, height);
    if (!r) continue;
    cam.scale *= r.scale ?? 1;
    cam.dx += r.dx ?? 0;
    cam.dy += r.dy ?? 0;
    cam.blur = Math.max(cam.blur, (r.blur ?? 0) / k0);
    cam.blurX = Math.max(cam.blurX, (r.blurX ?? 0) / k0);
    cam.blurY = Math.max(cam.blurY, (r.blurY ?? 0) / k0);
    cam.white = Math.max(cam.white, r.white ?? 0);
    cam.mirror = r.mirror ?? cam.mirror;
    if ((r.vhs ?? 0) > cam.vhs) {
      cam.vhs = r.vhs!;
      cam.seed = r.seed ?? "";
    }
  }
  return cam;
}

// Tape noise of the VHS cut: scan lines, snow bands, a torn bottom line, colour bleeding on the edges. CSS gradients
// drawn with random(seed): every render gives the same frames.
const TapeNoise: React.FC<{ force: number; seed: string; height: number }> = ({ force, seed, height }) => {
  const bands = [0, 1, 2].map((i) => ({
    y: random(`${seed}y${i}`) * height,
    h: (16 + random(`${seed}h${i}`) * 90) * (height / 1920),
    shift: random(`${seed}d${i}`) * 40,
    o: 0.35 + 0.5 * random(`${seed}o${i}`),
  }));
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: Math.min(1, force) }}>
      <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(255,0,90,0.16), transparent 22%, transparent 78%, rgba(0,210,255,0.16))" }} />
      <AbsoluteFill style={{ background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.22) 0px, rgba(0,0,0,0.22) 2px, transparent 2px, transparent 5px)" }} />
      {bands.map((b, i) => (
        <div key={i} style={{ position: "absolute", left: 0, right: 0, top: b.y, height: b.h, opacity: b.o, backgroundPosition: `${b.shift.toFixed(1)}px 0`,
          backgroundImage: `repeating-linear-gradient(90deg, rgba(255,255,255,0.8) 0px, rgba(255,255,255,0.8) 2px, rgba(140,160,190,0.3) 2px, rgba(140,160,190,0.3) ${5 + i * 3}px, transparent ${5 + i * 3}px, transparent ${11 + i * 4}px)` }} />
      ))}
      <div style={{ position: "absolute", left: -60, right: -60, bottom: 0, height: 0.035 * height, transform: `translateX(${((random(`${seed}bx`) - 0.5) * 80).toFixed(1)}px)`,
        background: "repeating-linear-gradient(90deg, rgba(255,255,255,0.5) 0px, rgba(255,255,255,0.5) 3px, rgba(0,0,0,0.6) 3px, rgba(0,0,0,0.6) 9px)" }} />
    </AbsoluteFill>
  );
};

/**
 * Wrap your shots (a <Series>, an <OffthreadVideo> with cuts…) and list the cuts. Mirrored transitions draw the
 * children three times for a few frames: keep <Audio> outside this component.
 */
export const SnapTransitions: React.FC<{ cuts: Cut[]; children: React.ReactNode }> = ({ cuts, children }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const filterId = `snap-motion-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const cam = snapCamera(cuts, frame, width, height);
  const filters: string[] = [];
  if (cam.blur > 0.3) filters.push(`blur(${cam.blur.toFixed(1)}px)`);
  if (cam.blurX > 0.3 || cam.blurY > 0.3) filters.push(`url(#${filterId})`);
  if (cam.vhs > 0.01) filters.push(`saturate(${(1 + 0.3 * cam.vhs).toFixed(3)}) contrast(${(1 + 0.1 * cam.vhs).toFixed(3)})`);
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {(cam.blurX > 0.3 || cam.blurY > 0.3) && (
        <svg width={0} height={0} style={{ position: "absolute" }}>
          {/* Filter region in px around the frame: the mirrored copies reach one frame out on each side. */}
          <filter id={filterId} filterUnits="userSpaceOnUse" x={-width} y={-height} width={3 * width} height={3 * height}>
            <feGaussianBlur stdDeviation={`${cam.blurX.toFixed(2)} ${cam.blurY.toFixed(2)}`} />
          </filter>
        </svg>
      )}
      <AbsoluteFill style={{ transform: `translate(${cam.dx.toFixed(2)}px, ${cam.dy.toFixed(2)}px) scale(${cam.scale.toFixed(4)})`, filter: filters.join(" ") || undefined }}>
        {children}
        {cam.mirror && (
          // Mirrored edges (mirror-slide, whip, bullet): two flipped copies glued to the frame.
          <>
            <AbsoluteFill style={{ transform: cam.mirror === "x" ? `translateX(${width}px) scaleX(-1)` : `translateY(${height}px) scaleY(-1)` }}>{children}</AbsoluteFill>
            <AbsoluteFill style={{ transform: cam.mirror === "x" ? `translateX(${-width}px) scaleX(-1)` : `translateY(${-height}px) scaleY(-1)` }}>{children}</AbsoluteFill>
          </>
        )}
      </AbsoluteFill>
      {cam.white > 0 && <AbsoluteFill style={{ background: "white", opacity: cam.white }} />}
      {cam.vhs > 0.01 && <TapeNoise force={cam.vhs} seed={cam.seed} height={height} />}
    </AbsoluteFill>
  );
};
