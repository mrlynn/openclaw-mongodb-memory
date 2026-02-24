import { redirect } from "next/navigation";

export default function ReflectionPage() {
  redirect("/operations?tab=reflection");
}
