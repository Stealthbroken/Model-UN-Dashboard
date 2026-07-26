import { SkeletonPage } from "@/components/Skeletons";

export default function Loading() {
  return <SkeletonPage stats={3} rows={5} maxWidth="max-w-2xl mx-auto" />;
}
