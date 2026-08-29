"use client";

import dynamic from "next/dynamic";
import ViewSkeleton from "@/components/ViewSkeleton";

const FeedbackView = dynamic(() => import("@/components/views/FeedbackView"), {
  ssr: false,
  loading: () => <ViewSkeleton />,
});

export default function Page() {
  return <FeedbackView />;
}
