"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Referral = {
  id: string;
  created_at: string;
  status: string;
  program_type: "customer" | "partner";
  referred_name: string | null;
  referred_phone: string | null;
  referred_email: string | null;
  referred_address: string | null;
};

type Profile = {
  id: string;
  account_type: "customer" | "partner";
  is_admin: boolean;
  payout_preference: "cash" | "credit" | null;
};

type LedgerEntry = {
  id: string;
  created_at: string;
  entry_type: string;
  amount: number;
  currency_type: "USD_CASH" | "USD_CREDIT" | "POINTS";
  memo: string | null;
};

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  // new referral form
  const [referredName, setReferredName] = useState("");
  const [referredPhone, setReferredPhone] = useState("");
  const [referredEmail, setReferredEmail] = useState("");
  const [referredAddress, setReferredAddress] = useState("");
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setError(null);
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user) {
        window.location.href = "/";
        return;
      }

      // ensure profile exists (trigger via DB function or upsert)
      const { data: prof, error: profErr } = await supabase.from("profiles").select("id, account_type, is_admin, payout_preference").eq("id", data.session.user.id).single();
      if (profErr) { setError(profErr.message); setLoading(false); return; }
      setProfile(prof as any);

      const { data: refs, error: refErr } = await supabase.from("referrals").select("*").order("created_at", { ascending: false });
      if (refErr) setError(refErr.message);
      setReferrals((refs as any) ?? []);

      const { data: led, error: ledErr } = await supabase.from("ledger_entries").select("*").order("created_at", { ascending: false }).limit(50);
      if (ledErr) setError(ledErr.message);
      setLedger((led as any) ?? []);

      setLoading(false);
    })();
  }, []);

  const sums = useMemo(() => {
    let cash = 0, credit = 0, points = 0;
    for (const e of ledger) {
      if (e.currency_type === "USD_CASH") cash += e.amount;
      if (e.currency_type === "USD_CREDIT") credit += e.amount;
      if (e.currency_type === "POINTS") points += e.amount;
    }
    return { cash, credit, points };
  }, [ledger]);

  async function submitReferral() {
    setSubmitMsg(null);
    setError(null);
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) { setError("Not signed in."); return; }

    const program_type = profile?.account_type ?? "customer";

    const { error } = await supabase.from("referrals").insert({
      referrer_user_id: data.session.user.id,
      program_type,
      referred_name: referredName || null,
      referred_phone: referredPhone || null,
      referred_email: referredEmail || null,
      referred_address: referredAddress || null,
      status: "Submitted",
    });

    if (error) { setError(error.message); return; }
    setSubmitMsg("Referral submitted.");
    setReferredName(""); setReferredPhone(""); setReferredEmail(""); setReferredAddress("");

    const { data: refs } = await supabase.from("referrals").select("*").order("created_at", { ascending: false });
    setReferrals((refs as any) ?? []);
  }

  async function setPayoutPreference(pref: "cash" | "credit") {
    setError(null);
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) return;
    const { error } = await supabase.from("profiles").update({ payout_preference: pref }).eq("id", data.session.user.id);
    if (error) { setError(error.message); return; }
    setProfile((p) => p ? ({ ...p, payout_preference: pref } as any) : p);
  }

  if (loading) return <div className="container"><div className="card">Loading…</div></div>;

  return (
    <div className="container">
      <div className="nav">
        <div>
          <strong>Dashboard</strong>
          <div className="small">Track referrals and rewards.</div>
        </div>
        <div className="row">
          <Link className="btn" href="/">Home</Link>
          {profile?.is_admin && <Link className="btn btnWarn" href="/admin">Admin</Link>}
          <Link className="btn" href="/logout">Sign out</Link>
        </div>
      </div>

      {error && <div className="card" style={{ borderColor: "#ef4444" }}><strong>Error:</strong> {error}</div>}

      <div className="grid2">
        <div className="card">
          <h2>My Rewards</h2>
          {profile?.account_type === "partner" ? (
            <>
              <div className="row">
                <span className="badge">Points Balance</span>
                <strong>{sums.points.toFixed(0)}</strong>
              </div>
              <div style={{ height: 10 }} />
              <Link className="btn btnPrimary" href="/redeem">Redeem Points</Link>
              <div className="small" style={{ marginTop: 10 }}>
                Points are issued after completed work and can be redeemed via the catalog.
              </div>
            </>
          ) : (
            <>
              <div className="row">
                <span className="badge">Cash Earned (net)</span>
                <strong>${sums.cash.toFixed(2)}</strong>
              </div>
              <div className="row" style={{ marginTop: 6 }}>
                <span className="badge">Account Credit Balance</span>
                <strong>${sums.credit.toFixed(2)}</strong>
              </div>
              <hr />
              <div className="small">Payout preference</div>
              <div className="row" style={{ marginTop: 8 }}>
                <button className={"btn " + (profile?.payout_preference === "cash" ? "btnPrimary" : "")} onClick={() => setPayoutPreference("cash")}>Cash</button>
                <button className={"btn " + (profile?.payout_preference === "credit" ? "btnPrimary" : "")} onClick={() => setPayoutPreference("credit")}>Account Credit</button>
              </div>
              <div className="small" style={{ marginTop: 10 }}>
                Rewards are issued after completed work. Credits can be applied to invoices by the office.
              </div>
            </>
          )}
        </div>

        <div className="card">
          <h2>Refer Someone</h2>
          <label className="label">Name</label>
          <input className="input" value={referredName} onChange={(e) => setReferredName(e.target.value)} placeholder="Friend / Client name" />
          <div style={{ height: 8 }} />
          <label className="label">Phone</label>
          <input className="input" value={referredPhone} onChange={(e) => setReferredPhone(e.target.value)} placeholder="+1..." />
          <div style={{ height: 8 }} />
          <label className="label">Email</label>
          <input className="input" value={referredEmail} onChange={(e) => setReferredEmail(e.target.value)} placeholder="friend@example.com" />
          <div style={{ height: 8 }} />
          <label className="label">Address (optional)</label>
          <input className="input" value={referredAddress} onChange={(e) => setReferredAddress(e.target.value)} placeholder="Street, City" />
          <div className="small" style={{ marginTop: 8 }}>
            By submitting, you confirm you have permission to share this contact information.
          </div>
          <div style={{ height: 10 }} />
          <button className="btn btnPrimary" onClick={submitReferral}>Submit Referral</button>
          {submitMsg && <div className="small" style={{ marginTop: 10 }}>{submitMsg}</div>}
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h2>My Referrals</h2>
        <div className="small">Latest first. Status updates are handled by the office/admin.</div>
        <div style={{ height: 10 }} />
        <div className="grid">
          {referrals.map((r) => (
            <div key={r.id} className="card" style={{ padding: 12 }}>
              <div className="row">
                <strong>{r.referred_name ?? "Referral"}</strong>
                <span className="badge">{r.program_type === "partner" ? "Partner" : "Customer"}</span>
                <span className="badge">{r.status}</span>
              </div>
              <div className="small" style={{ marginTop: 6 }}>
                {r.referred_phone ?? ""} {r.referred_email ? `• ${r.referred_email}` : ""} {r.referred_address ? `• ${r.referred_address}` : ""}
              </div>
            </div>
          ))}
          {referrals.length === 0 && <div className="small">No referrals yet.</div>}
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h2>Ledger (last 50 entries)</h2>
        <div className="small">Balances are computed from this ledger.</div>
        <div style={{ height: 10 }} />
        <div className="grid">
          {ledger.map((e) => (
            <div key={e.id} className="card" style={{ padding: 12 }}>
              <div className="row">
                <span className="badge">{e.currency_type}</span>
                <span className="badge">{e.entry_type}</span>
                <strong>{e.currency_type === "POINTS" ? e.amount.toFixed(0) : `$${e.amount.toFixed(2)}`}</strong>
              </div>
              <div className="small" style={{ marginTop: 6 }}>{e.memo ?? ""}</div>
            </div>
          ))}
          {ledger.length === 0 && <div className="small">No ledger entries yet.</div>}
        </div>
      </div>
    </div>
  );
}
