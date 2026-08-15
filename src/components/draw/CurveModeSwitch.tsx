import { Switch } from "@/components/ui/switch";
import { useLineStore } from "@/store/line-store";

/**
 * Toggles advanced curve editing — plain on/off phrasing (vs. the old
 * "advanced" button, whose pressed/unpressed color was the only cue) so it
 * reads clearly to someone who's never seen the app: flip it on, then tap a
 * point to reveal its type (see PointTypeToolbar).
 */
export function CurveModeSwitch() {
  const curveMode = useLineStore((s) => s.curveMode);
  const setCurveMode = useLineStore((s) => s.setCurveMode);
  const checked = curveMode === "advanced";

  return (
    <label className="absolute left-6 top-4 z-20 flex cursor-pointer items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-1.5 shadow-sm">
      <Switch checked={checked} onCheckedChange={(v) => setCurveMode(v ? "advanced" : "simple")} />
      <span className="text-xs font-medium text-foreground/80">advanced points</span>
    </label>
  );
}
