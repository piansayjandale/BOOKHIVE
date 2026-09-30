import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth";
import { getDashboardPathForRole } from "@/lib/routing";

export default async function HomePage() {
  const session = await getSession();
  redirect(session ? getDashboardPathForRole(session.role) : "/login");
}
