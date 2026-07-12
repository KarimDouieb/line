import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type ExportRowProps = {
  title: string;
  description: string;
  status: "active" | "soon" | "planned";
  onAction: () => void;
  className?: string;
};

export function ExportRow({ title, description, status, onAction, className }: ExportRowProps) {
  const dim = status !== "active";
  return (
    <div
      onClick={onAction}
      className={cn(
        "flex cursor-pointer items-center justify-between border-t border-border px-1 py-4 transition-colors hover:bg-secondary/40",
        className,
      )}
    >
      <div>
        <div className={cn("font-serif text-sm", dim ? "text-foreground/55" : "text-foreground")}>{title}</div>
        <div className={cn("mt-0.5 text-[11px]", dim ? "text-foreground/45" : "text-muted-foreground")}>
          {description}
        </div>
      </div>
      {status === "active" && (
        <Button size="sm" className="rounded-full text-[11px] font-medium tracking-[0.06em]" onClick={onAction}>
          download
        </Button>
      )}
      {status === "soon" && (
        <Badge variant="outline" className="rounded-full text-[10px] font-medium tracking-[0.06em] text-muted-foreground">
          soon
        </Badge>
      )}
      {status === "planned" && (
        <Badge variant="outline" className="rounded-full border-accent/40 text-[10px] font-medium tracking-[0.06em] text-accent">
          planned
        </Badge>
      )}
    </div>
  );
}
