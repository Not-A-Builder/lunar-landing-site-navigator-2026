import { Suspense } from "react";
import { DefaultHeaderBar, HeaderBar } from "./HeaderBar";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-5 px-4">
        {/* HeaderBar reads the URL (useSearchParams), so it needs a Suspense parent (D-128). */}
        <Suspense fallback={<DefaultHeaderBar />}>
          <HeaderBar />
        </Suspense>
      </div>
    </header>
  );
}
