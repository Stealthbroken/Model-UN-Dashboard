import { SkeletonPage } from "@/components/Skeletons";

export default function Loading() {
  return <SkeletonPage stats={0} rows={3} maxWidth="max-w-lg" />;
}
