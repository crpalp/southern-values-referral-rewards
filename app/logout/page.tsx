"use client";

import { useEffect } from "react";
import { signOut } from "@/lib/auth";
import { useRouter } from "next/navigation";

export default function LogoutPage() {
  const router = useRouter();
  useEffect(() => {
    (async () => {
      await signOut();
      router.replace("/");
    })();
  }, [router]);

  return <div className="container"><div className="card">Signing out…</div></div>;
}
