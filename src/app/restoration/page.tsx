"use client";

import dynamic from "next/dynamic";
import ViewSkeleton from "@/components/ViewSkeleton";

const RestorationView = dynamic(() => import("@/components/views/RestorationView"), {
  ssr: false,
  loading: () => <ViewSkeleton />,
});

export default function Page() {
  return <RestorationView />;
}
