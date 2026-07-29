import { redirect } from "next/navigation";

export default function LegacyMyReviewsPage() {
  redirect("/me/activity");
}
