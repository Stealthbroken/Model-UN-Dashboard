// Route-level skeleton: every page is force-dynamic and rendered against
// Appwrite Cloud, so navigation blocks on the network. This gives instant
// visual feedback instead of a frozen screen.
export default function Loading() {
  return (
    <div className="max-w-5xl animate-pulse" aria-busy="true" aria-label="Loading page">
      <div className="mb-6">
        <div className="h-7 w-48 bg-gray-200 rounded" />
        <div className="h-4 w-72 bg-gray-100 rounded mt-2" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-white border border-gray-200 rounded-xl" />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-44 bg-white border border-gray-200 rounded-xl" />
        <div className="h-44 bg-white border border-gray-200 rounded-xl" />
      </div>

      <div className="h-56 bg-white border border-gray-200 rounded-xl mt-6" />
    </div>
  );
}
