// app/components/RequireAuth.js
"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getToken } from "../lib/auth";

export default function RequireAuth({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/")}`);
      return;
    }
    setReady(true);
  }, [router, pathname]);

  if (!ready) return null;
  return children;
}