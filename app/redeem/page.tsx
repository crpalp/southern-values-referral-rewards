"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type CatalogItem = {
  id: string;
  name: string;
  description: string | null;
  points_cost: number;
  is_active: boolean;
};

type LedgerEntry = {
  currency_type: "POINTS";
  amount: number;
};

export default function RedeemPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setError(null);
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user) { window.location.href = "/"; return; }

      const { data: prof } = await supabase.from("profiles").select("account_type").eq("id", data.session.user.id).single();
      if (prof?.account_type !== "partner") { window.location.href = "/dashboard"; return; }

      const { data: cat, error: catErr } = await supabase.from("catalog_items").select("*").eq("is_active", true).order("points_cost", { ascending: true });
      if (catErr) setError(catErr.message);
      setItems((cat as any) ?? []);

      const { data: led, error: ledErr } = await supabase.from("ledger_entries").select("currency_type, amount").eq("currency_type", "POINTS");
      if (ledErr) setError(ledErr.message);
      setLedger((led as any) ?? []);

      setLoading(false);
    })();
  }, []);

  const pointsBalance = useMemo(() => ledger.reduce((s, e) => s + e.amount, 0), [ledger]);

  async function requestRedeem(item: CatalogItem) {
    setError(null);
    setMessage(null);
    if (pointsBalance < item.points_cost) {
      setError("Insufficient points.");
      return;
    }

    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) return;

    const { error } = await supabase.from("redemption_requests").insert({
      user_id: data.session.user.id,
      catalog_item_id: item.id,
      points_cost: item.points_cost,
      status: "Requested",
    });

    if (error) { setError(error.message); return; }
    setMessage("Redemption request submitted. The office will follow up to fulfill it.");
  }

  if (loading) return <div className="container"><div className="card">Loading…</div></div>;

  return (
    <div className="container">
      <div className="nav">
        <div>
          <strong>Redeem Points</strong>
          <div className="small">Select an item. The office fulfills redemptions.</div>
        </div>
        <div className="row">
          <Link className="btn" href="/dashboard">Dashboard</Link>
          <Link className="btn" href="/logout">Sign out</Link>
        </div>
      </div>

      {error && <div className="card" style={{ borderColor: "#ef4444" }}><strong>Error:</strong> {error}</div>}
      {message && <div className="card" style={{ borderColor: "#22c55e" }}><strong>Success:</strong> {message}</div>}

      <div className="card">
        <div className="row">
          <span className="badge">Points Balance</span>
          <strong>{pointsBalance.toFixed(0)}</strong>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h2>Catalog</h2>
        <div className="grid">
          {items.map((i) => (
            <div key={i.id} className="card" style={{ padding: 12 }}>
              <div className="row">
                <strong>{i.name}</strong>
                <span className="badge">{i.points_cost} pts</span>
              </div>
              {i.description && <div className="small" style={{ marginTop: 6 }}>{i.description}</div>}
              <div style={{ height: 10 }} />
              <button className="btn btnPrimary" onClick={() => requestRedeem(i)}>Request Redemption</button>
            </div>
          ))}
          {items.length === 0 && <div className="small">No active catalog items yet. Admin can add items in the Admin panel.</div>}
        </div>
      </div>
    </div>
  );
}
