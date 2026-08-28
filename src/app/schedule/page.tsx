"use client";

import dynamic from "next/dynamic";
import ViewSkeleton from "@/components/ViewSkeleton";

const ScheduleView = dynamic(() => import("@/components/views/ScheduleView"), {
  ssr: false,
  loading: () => <ViewSkeleton />,
});

export default function Page() {
  return <ScheduleView />;
}
