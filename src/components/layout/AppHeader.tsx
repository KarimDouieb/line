import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLineStore } from "@/store/line-store";
import type { PRESETS } from "@/lib/line-math";
import { parseLineFile } from "@/lib/line-file";

const TABS = [
  { to: "/draw", label: "draw" },
  { to: "/family", label: "family" },
  { to: "/export", label: "export" },
] as const;

const TEMPLATES: (keyof typeof PRESETS)[] = ["bowl", "cup", "vase", "bottle"];

export function AppHeader() {
  const pathname = useLocation({ select: (l) => l.pathname });
  const onDraw = pathname === "/draw";

  const heightCm = useLineStore((s) => s.heightCm);
  const setHeightCm = useLineStore((s) => s.setHeightCm);
  const clear = useLineStore((s) => s.clear);
  const undo = useLineStore((s) => s.undo);
  const applyTemplate = useLineStore((s) => s.applyTemplate);
  const loadLineFile = useLineStore((s) => s.loadLineFile);
  const curveMode = useLineStore((s) => s.curveMode);
  const setCurveMode = useLineStore((s) => s.setCurveMode);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so re-selecting the same file still fires onChange
    if (!file) return;
    const data = parseLineFile(await file.text());
    if (!data) {
      toast("couldn't read that .line file");
      return;
    }
    loadLineFile(data);
    toast(`${file.name} loaded`);
  };

  // Decoupled from the store so an in-progress edit (e.g. clearing the field
  // to retype) doesn't get clobbered by the "committed" value re-rendering it.
  const [heightInput, setHeightInput] = useState(String(heightCm));
  useEffect(() => setHeightInput(String(heightCm)), [heightCm]);

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setHeightInput(raw);
    const n = Number.parseFloat(raw);
    if (n >= 3 && n <= 90) setHeightCm(n);
  };

  return (
    <header className="grid h-14 flex-none grid-cols-[1fr_auto_1fr] items-center border-b border-border px-6">
      <div className="flex items-center gap-2.5">
        <span className="font-serif text-[22px] font-medium text-foreground">Line</span>
        <span className="font-serif text-xl text-foreground/50">線</span>
        <span className="size-1.5 rounded-full bg-accent" />
      </div>

      <nav className="flex justify-center gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            className="select-none border-b-2 border-transparent px-3.5 py-4 text-xs font-medium tracking-[0.08em] text-foreground/85 transition-colors hover:text-accent"
            activeProps={{ className: "!border-accent" }}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center justify-end gap-1.5">
        {onDraw && (
          <>
            <Button variant="ghost" size="sm" className="rounded-full text-xs font-medium" onClick={() => clear()}>
              new line
            </Button>
            <Button variant="ghost" size="sm" className="rounded-full text-xs font-medium" onClick={() => undo()}>
              undo
            </Button>
            <Button
              variant={curveMode === "advanced" ? "default" : "ghost"}
              size="sm"
              className="rounded-full text-xs font-medium"
              onClick={() => setCurveMode(curveMode === "advanced" ? "simple" : "advanced")}
            >
              advanced
            </Button>
            <div className="mx-1 h-4 w-px bg-border" />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="sm" className="rounded-full text-xs font-medium">
                    input ▾
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="flex items-baseline justify-between font-normal">
                    <span>freehand stroke</span>
                    <span className="text-[10px] text-accent">active</span>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <div className="px-2 pb-1.5 pt-1 text-[10px] tracking-[0.1em] text-muted-foreground">
                  TEMPLATE CURVE
                </div>
                <div className="flex flex-wrap gap-1 px-1.5 pb-1.5">
                  {TEMPLATES.map((name) => (
                    <DropdownMenuItem
                      key={name}
                      onClick={() => {
                        applyTemplate(name);
                        toast(`${name} loaded — drag the points`);
                      }}
                      className="w-auto rounded-full border border-border px-2.5 py-1 text-xs hover:bg-secondary"
                    >
                      {name}
                    </DropdownMenuItem>
                  ))}
                </div>
                <DropdownMenuSeparator />
                <div className="px-2 pb-1.5 pt-1 text-[10px] tracking-[0.1em] text-muted-foreground">IMPORT</div>
                <div className="px-1.5 pb-1.5">
                  <DropdownMenuItem
                    onClick={() => fileInputRef.current?.click()}
                    className="w-auto rounded-full border border-border px-2.5 py-1 text-xs hover:bg-secondary"
                  >
                    .line file…
                  </DropdownMenuItem>
                </div>
                {/* <DropdownMenuSeparator /> */}
                {/* <DropdownMenuItem
                  disabled
                  className="flex items-baseline justify-between opacity-45"
                  onClick={() => toast("photo → line — planned for a later study")}
                >
                  <span>photo → line</span>
                  <Badge variant="outline" className="rounded-full text-[10px]">
                    soon
                  </Badge>
                </DropdownMenuItem> */}
              </DropdownMenuContent>
            </DropdownMenu>
            <input ref={fileInputRef} type="file" accept=".line" className="hidden" onChange={handleImportFile} />
            <div className="mx-1 h-4 w-px bg-border" />
          </>
        )}
        <Input
          type="number"
          value={heightInput}
          onChange={handleHeightChange}
          className="h-auto w-10 rounded-none border-0 border-b border-input bg-transparent p-0 text-center text-xs font-medium shadow-none focus-visible:ring-0"
        />
        <span className="text-[11px] text-muted-foreground">cm</span>
      </div>
    </header>
  );
}
