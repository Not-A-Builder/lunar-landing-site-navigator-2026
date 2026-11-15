import { HistoryView } from "@/components/history/HistoryView";

export const metadata = { title: "History" };

/** Site details and comparisons opened in this browser (D-131). The list lives in localStorage, so it renders on the client. */
export default function HistoryPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">History</h1>
        <p className="text-sm text-muted">
          Site details and comparisons you&apos;ve opened in this browser, newest first. Star one to keep it at the top. Opening an item shows the same sites at the same landing times.
        </p>
      </header>
      <HistoryView />
    </div>
  );
}
