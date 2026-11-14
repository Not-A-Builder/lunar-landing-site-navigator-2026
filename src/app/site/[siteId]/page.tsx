import { Suspense } from "react";
import { notFound } from "next/navigation";
import { SiteDetails } from "@/components/site-details/SiteDetails";
import { getSite, sites } from "@/lib/sites";

export function generateStaticParams() {
  return [...sites.filter((s) => s.lat !== null).map((s) => ({ siteId: s.id })), { siteId: "custom" }];
}

/** Params and search params are read inside Suspense (Cache Components rule: instant navigation shell). */
export default function SitePage({ params }: PageProps<"/site/[siteId]">) {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted">Loading site…</div>}>
      <SiteLoader params={params} />
    </Suspense>
  );
}

async function SiteLoader({ params }: { params: PageProps<"/site/[siteId]">["params"] }) {
  const { siteId } = await params;
  const site = siteId === "custom" ? null : getSite(siteId);
  if (siteId !== "custom" && !site) notFound();
  return <SiteDetails site={site ?? null} />;
}
