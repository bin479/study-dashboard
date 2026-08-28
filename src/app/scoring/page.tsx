"use client";

import dynamic from "next/dynamic";
import ViewSkeleton from "@/components/ViewSkeleton";

const ScoringView = dynamic(() => import("@/components/views/ScoringView"), {
  ssr: false,
  loading: () => <ViewSkeleton />,
});

export default function Page() {
  return <ScoringView />;
}
