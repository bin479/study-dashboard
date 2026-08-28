"use client";

import dynamic from "next/dynamic";
import ViewSkeleton from "@/components/ViewSkeleton";

const HomeView = dynamic(() => import("@/components/views/HomeView"), {
  ssr: false,
  loading: () => <ViewSkeleton />,
});

export default function Page() {
  return <HomeView />;
}
