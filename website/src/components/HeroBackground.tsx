// SPDX-License-Identifier: GPL-3.0-or-later
// 移植自 dstrml/wu 的 HeroBackground.tsx，来源提交及原作者见 website/NOTICE.md。
// 2026-11-16：接入 Line 首屏，并补充资源释放与动态效果偏好处理。
import { useEffect, useState } from "react";
import { FluidBackground } from "./FluidBackground";
import { InkBackground } from "./InkBackground";

type Effect = "interactive" | "auto" | "ink";

export function HeroBackground() {
  const [effect, setEffect] = useState<Effect | null>(null);

  useEffect(() => {
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    const coarsePointer = matchMedia("(hover: none) and (pointer: coarse)");
    const update = () => setEffect(reducedMotion.matches ? "ink" : coarsePointer.matches ? "auto" : "interactive");
    update();
    reducedMotion.addEventListener("change", update);
    coarsePointer.addEventListener("change", update);
    return () => {
      reducedMotion.removeEventListener("change", update);
      coarsePointer.removeEventListener("change", update);
    };
  }, []);

  if (effect === null) return null;
  if (effect === "ink") return <InkBackground />;
  return <FluidBackground auto={effect === "auto"} onUnavailable={() => setEffect("ink")} />;
}
