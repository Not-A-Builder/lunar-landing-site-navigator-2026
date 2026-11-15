import { Suspense } from "react";
import { NameFooter } from "@/components/NameFooter";
import { SiteSelection } from "@/components/site-selection/SiteSelection";
import { catalog } from "@/lib/metrics";
import { sites } from "@/lib/sites";

export default function Home() {
  // SiteSelection reads ?s= (scenarios being collected for comparison) with useSearchParams.
  // The name footer (D-147) sits below the full-height map and list, reached by scrolling.
  return (
    <>
      <Suspense>
        <SiteSelection />
      </Suspense>
      <div className="mx-auto max-w-[1600px] px-4 pb-24">
        <NameFooter sites={sites.length} metrics={catalog.metrics.length} className="mt-16" />
      </div>
    </>
  );
}
