"use client";

import dynamic from "next/dynamic";
import ViewSkeleton from "@/components/ViewSkeleton";

const SyncView = dynamic(() => import("@/components/views/SyncView"), {
  ssr: false,
  loading: () => <ViewSkeleton />,
});

export default function Page() {
  return <SyncView />;
}
