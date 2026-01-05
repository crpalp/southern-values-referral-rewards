"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [msg, setMsg] = useState("Completing sign-in…");

  useEffect(() => {
    // Supabase handles the token exchange automatically in the browser.
    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) setMsg(error.message);
      if (data.session?.user) {
        router.replace("/dashboard");
      } else {
        setMsg("No session found. Return to home and try again.");
      }
    })();
  }, [router]);

  return <div className="container"><div className="card">{msg}</div></div>;
}
