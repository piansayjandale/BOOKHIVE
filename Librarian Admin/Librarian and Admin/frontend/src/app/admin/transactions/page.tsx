import { redirect } from "next/navigation";

export default function AdminTransactionsRedirectPage() {
  redirect("/admin/home");
}
