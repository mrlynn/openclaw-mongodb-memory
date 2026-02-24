import { redirect } from "next/navigation";

export default function RememberPage() {
  redirect("/dashboard?remember=1");
}
