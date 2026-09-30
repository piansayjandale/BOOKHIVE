"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { ShieldAlert, Home } from "lucide-react";
import { useSession } from "@/components/providers/session-provider";
import type { LibrarianPermissionKey } from "@/lib/types";
import { isSuperAdminRole, isAdminRole } from "@/lib/routing";

export function PermissionGuard({
  permission,
  children,
}: {
  permission: LibrarianPermissionKey;
  children: ReactNode;
}) {
  const { user } = useSession();

  // Admins and Super Admins are never restricted
  if (isSuperAdminRole(user?.role) || isAdminRole(user?.role)) {
    return <>{children}</>;
  }

  // If user has restricted this function
  if (user?.permissions && user.permissions[permission] === false) {
    return (
      <div className="flex min-h-[65vh] flex-col items-center justify-center p-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-red-500/20 bg-red-500/10 text-red-400 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
          <ShieldAlert className="h-10 w-10" />
        </div>
        <h2 className="mt-6 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Access Restricted
        </h2>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-400">
          This function has been restricted for your librarian account by the administrator. Please contact your library administrator if you require access to this section.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/librarian"
            className="flex items-center gap-2 rounded-xl bg-[#FCD400] px-5 py-2.5 text-sm font-bold text-slate-950 shadow-md transition-all hover:bg-[#ffe14d] active:scale-95"
          >
            <Home className="h-4 w-4" />
            <span>Return to Home</span>
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
