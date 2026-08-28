"use client";

import dynamic from "next/dynamic";
import ViewSkeleton from "@/components/ViewSkeleton";

const MoreView = dynamic(() => import("@/components/views/MoreView"), {
  ssr: false,
  loading: () => <ViewSkeleton />,
});

export default function Page() {
  return <MoreView />;
}
