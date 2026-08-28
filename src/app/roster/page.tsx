"use client";

import dynamic from "next/dynamic";
import ViewSkeleton from "@/components/ViewSkeleton";

const RosterView = dynamic(() => import("@/components/views/RosterView"), {
  ssr: false,
  loading: () => <ViewSkeleton />,
});

export default function Page() {
  return <RosterView />;
}
