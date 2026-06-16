"use client";

import { useParams } from "next/navigation";
import MonitorView from "@/components/MonitorView";

export default function MonitorPage() {
  const { code } = useParams<{ code: string }>();
  return <MonitorView code={code} />;
}
