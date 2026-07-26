import { SkeletonPage } from "@/components/Skeletons";

export default function Loading() {
  return <SkeletonPage stats={4} rows={5} maxWidth="max-w-5xl" />;
}
