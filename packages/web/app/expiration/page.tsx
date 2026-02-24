import { redirect } from "next/navigation";

export default function ExpirationPage() {
  redirect("/operations?tab=expiration");
}
