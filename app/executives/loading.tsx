import { SkeletonPage } from "@/components/Skeletons";

export default function Loading() {
  return <SkeletonPage stats={0} rows={5} maxWidth="max-w-3xl" />;
}
