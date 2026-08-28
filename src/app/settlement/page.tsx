"use client";

import dynamic from "next/dynamic";
import ViewSkeleton from "@/components/ViewSkeleton";

const SettlementView = dynamic(() => import("@/components/views/SettlementView"), {
  ssr: false,
  loading: () => <ViewSkeleton />,
});

export default function Page() {
  return <SettlementView />;
}
