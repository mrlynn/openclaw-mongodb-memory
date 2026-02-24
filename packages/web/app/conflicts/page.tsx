import { redirect } from "next/navigation";

export default function ConflictsPage() {
  redirect("/operations?tab=conflicts");
}
