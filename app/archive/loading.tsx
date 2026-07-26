import { SkeletonPage } from "@/components/Skeletons";

export default function Loading() {
  return <SkeletonPage stats={0} rows={6} maxWidth="max-w-4xl" />;
}
