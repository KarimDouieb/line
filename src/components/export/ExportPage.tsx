import { toast } from "sonner";
import { useLineStore } from "@/store/line-store";
import { downloadSvgProfile } from "@/lib/export-svg";
import { downloadFamilyPdf } from "@/lib/export-pdf";
import { downloadRibsStl } from "@/lib/export-stl";
import { ExportRow } from "@/components/export/ExportRow";
import { FamilyBoard } from "@/components/family/FamilyBoard";

export function ExportPage() {
  const controlPoints = useLineStore((s) => s.controlPoints);
  const heightCm = useLineStore((s) => s.heightCm);
  const vesselSet = useLineStore((s) => s.vesselSet);
  const adapt = useLineStore((s) => s.adapt);

  return (
    <div className="mx-auto mt-14 max-w-xl px-5">
      <div className="font-serif text-[22px] text-foreground">export</div>
      <div className="mb-5 mt-1 text-[11.5px] text-muted-foreground">
        everything leaves at real size — height set to {heightCm} cm
      </div>

      <div className="relative h-[260px] border-b border-border">
        <FamilyBoard fixedLayout="organic" />
      </div>

      <ExportRow
        title="SVG profile"
        description="outline in mm — for templates & ribs"
        status="active"
        onAction={() => {
          const ok = downloadSvgProfile(controlPoints, heightCm);
          toast(ok ? "SVG profile saved — real size, mm" : "draw a line first");
        }}
      />
      <ExportRow
        title="PDF at real scale"
        description="one page per shape, print, cut, hold against the wheel"
        status="active"
        onAction={async () => {
          const ok = await downloadFamilyPdf(controlPoints, heightCm, vesselSet, adapt);
          toast(ok ? "PDF saved — one page per shape, real size" : "draw a line first");
        }}
      />
      <ExportRow
        title="Turning ribs · 3D print"
        description="one rib per shape, STL, ready to print"
        status="active"
        onAction={() => {
          const ok = downloadRibsStl(controlPoints, heightCm, vesselSet, adapt);
          toast(ok ? "STL saved — one rib per shape" : "draw a line first");
        }}
      />
    </div>
  );
}
