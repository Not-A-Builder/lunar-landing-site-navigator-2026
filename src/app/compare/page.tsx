import { Suspense } from "react";
import { CompareView } from "@/components/compare/CompareView";

export const metadata = { title: "Compare scenarios" };

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted">Loading comparison…</div>}>
      <CompareView />
    </Suspense>
  );
}
