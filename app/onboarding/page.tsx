"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function OnboardingPage() {
  const [loading, setLoading] = useState(true);
  const [accountType, setAccountType] = useState<"customer" | "partner">("customer");
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user) {
        setLoading(false);
        return;
      }
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", data.session.user.id).single();
      if (prof?.full_name) setFullName(prof.full_name);
      if (prof?.account_type) setAccountType(prof.account_type);
      setLoading(false);
    })();
  }, []);

  async function save() {
    setMessage(null);
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) {
      setMessage("Please sign in first.");
      return;
    }
    const { error } = await supabase.from("profiles").update({
      full_name: fullName || null,
      account_type: accountType,
    }).eq("id", data.session.user.id);

    if (error) setMessage(error.message);
    else setMessage("Saved. Go to your dashboard.");
  }

  return (
    <div className="container">
      <div className="nav">
        <div>
          <strong>Onboarding</strong>
          <div className="small">Choose Customer or Partner (Realtor) account type.</div>
        </div>
        <Link className="btn" href="/">Home</Link>
      </div>

      <div className="card">
        {loading ? "Loading…" : (
          <>
            <label className="label">Full name</label>
            <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" />
            <div style={{ height: 10 }} />

            <label className="label">Account type</label>
            <select className="input" value={accountType} onChange={(e) => setAccountType(e.target.value as any)}>
              <option value="customer">Customer</option>
              <option value="partner">Partner / Realtor</option>
            </select>

            <div className="small" style={{ marginTop: 10 }}>
              Customers can earn cash or account credit. Partners earn points and redeem via the catalog.
            </div>

            <div style={{ height: 12 }} />
            <button className="btn btnPrimary" onClick={save}>Save</button>
            {message && <div className="small" style={{ marginTop: 10 }}>{message}</div>}
          </>
        )}
      </div>
    </div>
  );
}
