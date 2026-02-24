import { redirect } from "next/navigation";

export default function HealthPage() {
  redirect("/settings?tab=health");
}
