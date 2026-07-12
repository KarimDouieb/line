import { FamilySidebar } from "@/components/family/FamilySidebar";
import { FamilyBoard } from "@/components/family/FamilyBoard";

export function FamilyPage() {
  return (
    <div className="flex min-h-0 flex-1">
      <FamilySidebar />
      <div className="relative min-w-0 flex-1">
        <FamilyBoard className="absolute inset-[18px_26px_14px]" />
      </div>
    </div>
  );
}
