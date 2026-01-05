"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Referral = any;
type Job = any;
type CatalogItem = any;
type Redemption = any;

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // catalog form
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");
  const [catCost, setCatCost] = useState<number>(250);

  useEffect(() => {
    (async () => {
      setError(null);
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user) { window.location.href = "/"; return; }

      const { data: prof, error: profErr } = await supabase.from("profiles").select("is_admin").eq("id", data.session.user.id).single();
      if (profErr) { setError(profErr.message); setLoading(false); return; }
      if (!prof?.is_admin) { window.location.href = "/dashboard"; return; }
      setIsAdmin(true);

      await refreshAll();
      setLoading(false);
    })();
  }, []);

  async function refreshAll() {
    const { data: refs, error: refErr } = await supabase.from("referrals_admin_view").select("*").order("created_at", { ascending: false }).limit(200);
    if (refErr) setError(refErr.message);
    setReferrals((refs as any) ?? []);

    const { data: cat, error: catErr } = await supabase.from("catalog_items").select("*").order("created_at", { ascending: false });
    if (catErr) setError(catErr.message);
    setCatalog((cat as any) ?? []);

    const { data: red, error: redErr } = await supabase.from("redemption_requests_admin_view").select("*").order("created_at", { ascending: false }).limit(200);
    if (redErr) setError(redErr.message);
    setRedemptions((red as any) ?? []);
  }

  async function setStatus(referral_id: string, status: string) {
    setError(null); setMessage(null);
    const { error } = await supabase.from("referrals").update({ status }).eq("id", referral_id);
    if (error) setError(error.message);
    else { setMessage(`Updated status to ${status}.`); await refreshAll(); }
  }

  async function denyReferral(referral_id: string) {
    const reason = prompt("Reason for denial (stored for audit):") || "Denied";
    const { error } = await supabase.from("referrals").update({ status: "Denied", denied_reason: reason }).eq("id", referral_id);
    if (error) setError(error.message);
    else { setMessage("Referral denied."); await refreshAll(); }
  }

  async function createJobAndIssue(ref: Referral) {
    setError(null); setMessage(null);
    const invoice_number = prompt("Invoice # (or job reference):") || "";
    const job_type = prompt("Job type: Repair / Replacement / VIP_MEMBERSHIP / VIP_RENEWAL", "Repair") || "Repair";
    const invoice_total_str = prompt("Invoice total (numbers only). Use 0 for membership/renewal points entries.", "0") || "0";
    const invoice_total = Number(invoice_total_str || "0") || 0;

    // create job
    const { data: job, error: jobErr } = await supabase.from("jobs").insert({
      referral_id: ref.id,
      job_type,
      invoice_number,
      invoice_total,
      completed_date: new Date().toISOString(),
    }).select("*").single();

    if (jobErr) { setError(jobErr.message); return; }

    // mark referral completed
    await supabase.from("referrals").update({ status: "Completed Work" }).eq("id", ref.id);

    // issue ledger entry based on rules
    const { data: rule, error: ruleErr } = await supabase
      .from("reward_rules")
      .select("*")
      .eq("program_type", ref.program_type)
      .eq("event_type", job_type)
      .eq("is_active", true)
      .order("effective_from", { ascending: false })
      .limit(1)
      .single();

    if (ruleErr) { setError("Job created, but rule lookup failed: " + ruleErr.message); await refreshAll(); return; }

    if (ref.program_type === "partner") {
      const points = rule.amount;
      const { error: ledErr } = await supabase.from("ledger_entries").insert({
        user_id: ref.referrer_user_id,
        referral_id: ref.id,
        job_id: job.id,
        entry_type: "Earned",
        currency_type: "POINTS",
        amount: points,
        memo: `Earned ${points} points for ${job_type} referral (Invoice ${invoice_number})`,
      });
      if (ledErr) setError(ledErr.message);
      else setMessage(`Issued ${points} points.`);
    } else {
      // customer: issue cash or credit based on payout preference
      const { data: prof } = await supabase.from("profiles").select("payout_preference").eq("id", ref.referrer_user_id).single();
      const pref = (prof as any)?.payout_preference ?? "cash";
      const currency_type = pref === "credit" ? "USD_CREDIT" : "USD_CASH";
      const amt = rule.amount;
      const { error: ledErr } = await supabase.from("ledger_entries").insert({
        user_id: ref.referrer_user_id,
        referral_id: ref.id,
        job_id: job.id,
        entry_type: pref === "credit" ? "EarnedCredit" : "EarnedCash",
        currency_type,
        amount: amt,
        memo: `Earned ${pref} reward for ${job_type} referral (Invoice ${invoice_number})`,
      });
      if (ledErr) setError(ledErr.message);
      else setMessage(`Issued $${amt.toFixed(2)} as ${pref}.`);
    }

    // set eligible
    await supabase.from("referrals").update({ status: "Eligible" }).eq("id", ref.id);
    await refreshAll();
  }

  async function addCatalogItem() {
    setError(null); setMessage(null);
    if (!catName.trim()) { setError("Catalog name required."); return; }
    const { error } = await supabase.from("catalog_items").insert({
      name: catName.trim(),
      description: catDesc.trim() || null,
      points_cost: catCost,
      is_active: true,
    });
    if (error) setError(error.message);
    else { setMessage("Catalog item added."); setCatName(""); setCatDesc(""); setCatCost(250); await refreshAll(); }
  }

  async function fulfillRedemption(r: Redemption) {
    setError(null); setMessage(null);
    // create negative ledger entry to deduct points, and mark fulfilled
    const { error: ledErr } = await supabase.from("ledger_entries").insert({
      user_id: r.user_id,
      redemption_request_id: r.id,
      entry_type: "Redeemed",
      currency_type: "POINTS",
      amount: -Number(r.points_cost),
      memo: `Redeemed points for: ${r.catalog_item_name}`,
    });
    if (ledErr) { setError(ledErr.message); return; }

    const ref = prompt("Fulfillment reference (invoice/receipt #, vendor, etc.)", "") || "";
    const { error: redErr } = await supabase.from("redemption_requests").update({
      status: "Fulfilled",
      fulfillment_reference: ref || null,
      fulfilled_at: new Date().toISOString(),
    }).eq("id", r.id);

    if (redErr) setError(redErr.message);
    else setMessage("Redemption fulfilled and points deducted.");
    await refreshAll();
  }

  if (loading) return <div className="container"><div className="card">Loading…</div></div>;
  if (!isAdmin) return null;

  return (
    <div className="container">
      <div className="nav">
        <div>
          <strong>Admin</strong>
          <div className="small">Approve referrals, issue rewards, manage catalog.</div>
        </div>
        <div className="row">
          <Link className="btn" href="/dashboard">Dashboard</Link>
          <Link className="btn" href="/logout">Sign out</Link>
        </div>
      </div>

      {error && <div className="card" style={{ borderColor: "#ef4444" }}><strong>Error:</strong> {error}</div>}
      {message && <div className="card" style={{ borderColor: "#22c55e" }}><strong>Note:</strong> {message}</div>}

      <div className="grid2">
        <div className="card">
          <h2>Catalog (Points)</h2>
          <div className="small">Used for Partner/ Realtor redemptions.</div>
          <hr />
          <label className="label">Item name</label>
          <input className="input" value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="e.g., Yard Sign Printing Credit" />
          <div style={{ height: 8 }} />
          <label className="label">Description</label>
          <input className="input" value={catDesc} onChange={(e) => setCatDesc(e.target.value)} placeholder="Paid directly to vendor; upload invoice." />
          <div style={{ height: 8 }} />
          <label className="label">Points cost</label>
          <input className="input" type="number" value={catCost} onChange={(e) => setCatCost(Number(e.target.value))} />
          <div style={{ height: 10 }} />
          <button className="btn btnPrimary" onClick={addCatalogItem}>Add Catalog Item</button>

          <hr />
          <div className="grid">
            {catalog.map((c: any) => (
              <div className="card" key={c.id} style={{ padding: 12 }}>
                <div className="row">
                  <strong>{c.name}</strong>
                  <span className="badge">{c.points_cost} pts</span>
                  <span className="badge">{c.is_active ? "Active" : "Inactive"}</span>
                </div>
                {c.description && <div className="small" style={{ marginTop: 6 }}>{c.description}</div>}
              </div>
            ))}
            {catalog.length === 0 && <div className="small">No catalog items yet.</div>}
          </div>
        </div>

        <div className="card">
          <h2>Redemption Requests</h2>
          <div className="small">Fulfill to deduct points and close the request.</div>
          <hr />
          <div className="grid">
            {redemptions.map((r: any) => (
              <div className="card" key={r.id} style={{ padding: 12 }}>
                <div className="row">
                  <strong>{r.catalog_item_name}</strong>
                  <span className="badge">{r.points_cost} pts</span>
                  <span className="badge">{r.status}</span>
                </div>
                <div className="small" style={{ marginTop: 6 }}>
                  Requested by: {r.user_display ?? r.user_id} • {new Date(r.created_at).toLocaleString()}
                </div>
                <div style={{ height: 10 }} />
                {r.status === "Requested" ? (
                  <button className="btn btnPrimary" onClick={() => fulfillRedemption(r)}>Fulfill & Deduct Points</button>
                ) : (
                  <div className="small">Fulfilled: {r.fulfillment_reference ?? "—"}</div>
                )}
              </div>
            ))}
            {redemptions.length === 0 && <div className="small">No requests.</div>}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h2>Referrals</h2>
        <div className="small">Approve, set status, and issue rewards (creates jobs + ledger entries).</div>
        <hr />
        <div className="grid">
          {referrals.map((r: any) => (
            <div key={r.id} className="card" style={{ padding: 12 }}>
              <div className="row">
                <strong>{r.referred_name ?? "Referral"}</strong>
                <span className="badge">{r.program_type}</span>
                <span className="badge">{r.status}</span>
              </div>
              <div className="small" style={{ marginTop: 6 }}>
                Referrer: {r.referrer_display ?? r.referrer_user_id} • {new Date(r.created_at).toLocaleString()}
              </div>
              <div className="small">
                {r.referred_phone ?? ""} {r.referred_email ? `• ${r.referred_email}` : ""} {r.referred_address ? `• ${r.referred_address}` : ""}
              </div>
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn" onClick={() => setStatus(r.id, "Approved")}>Approve</button>
                <button className="btn" onClick={() => setStatus(r.id, "Scheduled")}>Scheduled</button>
                <button className="btn" onClick={() => setStatus(r.id, "Completed Work")}>Completed</button>
                <button className="btn" onClick={() => setStatus(r.id, "Eligible")}>Eligible</button>
                <button className="btn btnPrimary" onClick={() => createJobAndIssue(r)}>Create Job + Issue</button>
                <button className="btn" onClick={() => denyReferral(r.id)}>Deny</button>
              </div>
              {r.denied_reason && <div className="small" style={{ marginTop: 8 }}><strong>Denied reason:</strong> {r.denied_reason}</div>}
            </div>
          ))}
          {referrals.length === 0 && <div className="small">No referrals.</div>}
        </div>
      </div>
    </div>
  );
}
