import { Suspense } from "react";
import { SiteSelection } from "@/components/site-selection/SiteSelection";

export default function Home() {
  // SiteSelection reads ?s= (scenarios being collected for comparison) with useSearchParams.
  return (
    <Suspense>
      <SiteSelection />
    </Suspense>
  );
}
