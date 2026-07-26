export default function Loading() {
  return (
    <div className="max-w-5xl animate-pulse" aria-busy="true" aria-label="Loading meeting">
      <div className="h-4 w-24 bg-gray-200 rounded mb-4" />
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="h-8 w-64 bg-gray-200 rounded" />
        <div className="h-4 w-40 bg-gray-100 rounded mt-3" />
      </div>
      <div className="h-48 bg-white border border-gray-200 rounded-xl mt-6" />
      <div className="h-64 bg-white border border-gray-200 rounded-xl mt-6" />
    </div>
  );
}
