import { cn } from "@/lib/utils";
import { useLineStore, type FamilyLayout } from "@/store/line-store";
import type { AdaptMode, VesselSetName } from "@/lib/line-math";

const LAYOUTS: { key: FamilyLayout; label: string; desc: string }[] = [
  { key: "overlap", label: "sequence", desc: "one shelf, side by side" },
  { key: "grid", label: "mosaic", desc: "each study on its own sheet" },
  { key: "organic", label: "studio wall", desc: "one line, layered and overlapping" },
  { key: "echo", label: "echo", desc: "every size, one footprint" },
  { key: "scene", label: "still life · 3D", desc: "a real scene, drag to orbit" },
];

const VESSEL_SETS: { key: VesselSetName; label: string; desc: string }[] = [
  { key: "studio", label: "studio riffs", desc: "proportional cousins of your line" },
  { key: "classical", label: "classical", desc: "plate · bowl · cup · jar · vase · bottle" },
  { key: "cafe", label: "café", desc: "espresso · cappuccino · mug · glass · pitcher · carafe" },
  { key: "ikebana", label: "ikebana", desc: "tray · basin · moon · bud · cylinder" },
];

const ADAPTATIONS: { key: AdaptMode; label: string; desc: string }[] = [
  { key: "uniform", label: "stretch all", desc: "the whole line follows the box" },
  { key: "neck", label: "keep neck", desc: "rim & shoulder stay true" },
  { key: "foot", label: "keep foot", desc: "the base stays true" },
  { key: "ends", label: "keep both ends", desc: "rim and foot true, the belly stretches" },
  // { key: "weight", label: "keep weight", desc: "width follows height — same visual mass" },
  { key: "flare", label: "flare ends", desc: "the line shifts outward as one piece — rim and foot open the most" },
];

function Section<T extends string>({
  title,
  items,
  active,
  onPick,
}: {
  title: string;
  items: { key: T; label: string; desc: string }[];
  active: T;
  onPick: (key: T) => void;
}) {
  return (
    <div>
      <div className="px-1 pb-1.5 pt-4 text-[10px] font-medium tracking-[0.16em] text-muted-foreground">{title}</div>
      <div className="ml-3">{items.map((it) => (
        <button
          key={it.key}
          onClick={() => onPick(it.key)}
          className={cn(
            "flex w-full flex-col gap-px border-l-2 px-2 py-2 text-left transition-colors hover:bg-secondary/60",
            active === it.key ? "border-accent" : "border-transparent",
          )}
        >
          <span className="font-serif text-[13.5px] text-foreground">{it.label}</span>
          <span className="text-[10.5px] text-muted-foreground">{it.desc}</span>
        </button>
      ))}
      </div>
    </div>
  );
}

export function FamilySidebar() {
  const layout = useLineStore((s) => s.layout);
  const vesselSet = useLineStore((s) => s.vesselSet);
  const adapt = useLineStore((s) => s.adapt);
  const setLayout = useLineStore((s) => s.setLayout);
  const setVesselSet = useLineStore((s) => s.setVesselSet);
  const setAdapt = useLineStore((s) => s.setAdapt);

  return (
    <div className="w-[298px] flex-none overflow-y-auto border-r border-border pb-5">
      <div className="px-5 pt-5">
        <div className="font-serif text-[19px] text-foreground">family</div>
        <div className="mt-0.5 text-[10.5px] text-muted-foreground">
          how your line becomes a set · tap a vessel for its size
        </div>
      </div>
      <div className="px-3">
        <Section title="LAYOUT" items={LAYOUTS} active={layout} onPick={setLayout} />
        <Section title="VESSEL SET" items={VESSEL_SETS} active={vesselSet} onPick={setVesselSet} />
        <Section title="VARIATION" items={ADAPTATIONS} active={adapt} onPick={setAdapt} />
      </div>
    </div>
  );
}
