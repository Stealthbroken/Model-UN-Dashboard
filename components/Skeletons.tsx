/**
 * Loading placeholders used by each route's `loading.tsx`. Every page in this
 * app is `force-dynamic`, so without these the user stares at the previous
 * screen while Appwrite responds.
 *
 * Server components — no interactivity, so no "use client" needed.
 */

export function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`skeleton h-3 ${className}`} />;
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-2.5">
      <SkeletonLine className="w-1/3 h-4" />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} className={i % 3 === 2 ? "w-2/3" : "w-full"} />
      ))}
    </div>
  );
}

export function SkeletonHeader() {
  return (
    <div className="mb-6 space-y-2">
      <SkeletonLine className="w-48 h-6" />
      <SkeletonLine className="w-72" />
    </div>
  );
}

export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
          <SkeletonLine className="w-12 h-6" />
          <SkeletonLine className="w-20" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <SkeletonLine className="w-1/4 h-4 mb-4" />
      <div className="divide-y divide-gray-100">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            <div className="skeleton w-8 h-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <SkeletonLine className="w-1/2" />
              <SkeletonLine className="w-1/4 h-2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Generic page shell: header, optional stat row, then a list. */
export function SkeletonPage({
  stats = 0,
  rows = 5,
  maxWidth = "max-w-5xl",
}: {
  stats?: number;
  rows?: number;
  maxWidth?: string;
}) {
  return (
    <div className={maxWidth} aria-busy="true" aria-label="Loading">
      <SkeletonHeader />
      {stats > 0 && <SkeletonStats count={stats} />}
      <SkeletonRows count={rows} />
    </div>
  );
}
