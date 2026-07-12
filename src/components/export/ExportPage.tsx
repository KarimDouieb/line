import { toast } from "sonner";
import { useLineStore } from "@/store/line-store";
import { downloadSvgProfile } from "@/lib/export-svg";
import { ExportRow } from "@/components/export/ExportRow";

export function ExportPage() {
  const controlPoints = useLineStore((s) => s.controlPoints);
  const heightCm = useLineStore((s) => s.heightCm);

  return (
    <div className="mx-auto mt-14 max-w-xl px-5">
      <div className="font-serif text-[22px] text-foreground">export</div>
      <div className="mb-5 mt-1 text-[11.5px] text-muted-foreground">
        everything leaves at real size — height set to {heightCm} cm
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
        description="print, cut, hold against the wheel"
        status="soon"
        onAction={() => toast("PDF at real scale — coming soon")}
      />
      <ExportRow
        title="Turning ribs · 3D print"
        description="printable ribs that carry this exact curve"
        status="planned"
        onAction={() => toast("turning ribs for 3D print — on the roadmap")}
      />
      <ExportRow
        title="DXF · CAD"
        description="for laser cutting & CAD refinement"
        status="soon"
        onAction={() => toast("DXF for CAD — coming soon")}
        className="border-b"
      />
    </div>
  );
}
