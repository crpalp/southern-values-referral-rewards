"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { signInWithEmail, signInWithPhone, verifyPhoneOtp } from "@/lib/auth";

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  account_type: "customer" | "partner";
  is_admin: boolean;
};

export default function HomePage() {
  const [sessionLoading, setSessionLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  // login form state
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [smsSent, setSmsSent] = useState(false);
  const [smsCode, setSmsCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const sub = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) {
        setProfile(null);
        setSessionLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (error) {
        setMessage(error.message);
      } else {
        setProfile(data as Profile);
      }
      setSessionLoading(false);
    });

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user) {
        setSessionLoading(false);
        return;
      }
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", data.session.user.id).single();
      setProfile((prof as any) ?? null);
      setSessionLoading(false);
    })();

    return () => sub.data.subscription.unsubscribe();
  }, []);

  const isAuthed = useMemo(() => !!profile, [profile]);

  async function handleEmailLogin() {
    setMessage(null);
    if (!email.trim()) return setMessage("Enter an email.");
    const { error } = await signInWithEmail(email.trim());
    if (error) return setMessage(error.message);
    setMessage("Check your email for a sign-in link.");
  }

  async function handlePhoneLogin() {
    setMessage(null);
    if (!phone.trim()) return setMessage("Enter a phone number (E.164 preferred, e.g., +19418121571).");
    const { error } = await signInWithPhone(phone.trim());
    if (error) return setMessage(error.message);
    setSmsSent(true);
    setMessage("Enter the code you received by text.");
  }

  async function handleVerifyCode() {
    setMessage(null);
    if (!smsCode.trim()) return setMessage("Enter the SMS code.");
    const { error } = await verifyPhoneOtp(phone.trim(), smsCode.trim());
    if (error) return setMessage(error.message);
    setMessage(null);
  }

  if (sessionLoading) {
    return <div className="container"><div className="card">Loading…</div></div>;
  }

  if (!isAuthed) {
    return (
      <div className="container">
        <div className="nav">
          <div>
            <strong>Southern Values Referral Rewards</strong>
            <div className="small">Customer cash/credit + Realtor points in one portal.</div>
          </div>
        </div>

        <div className="grid2">
          <div className="card">
            <h2>Sign in with Email</h2>
            <label className="label">Email</label>
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            <div style={{ height: 10 }} />
            <button className="btn btnPrimary" onClick={handleEmailLogin}>Send Magic Link</button>
            <div className="small" style={{ marginTop: 10 }}>
              You’ll receive a sign-in link. After clicking it, you’ll be routed back here.
            </div>
          </div>

          <div className="card">
            <h2>Sign in with Text (SMS)</h2>
            <label className="label">Phone</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+19418121571" />
            <div style={{ height: 10 }} />
            {!smsSent ? (
              <button className="btn btnPrimary" onClick={handlePhoneLogin}>Send Code</button>
            ) : (
              <>
                <label className="label" style={{ marginTop: 10 }}>SMS Code</label>
                <input className="input" value={smsCode} onChange={(e) => setSmsCode(e.target.value)} placeholder="123456" />
                <div style={{ height: 10 }} />
                <button className="btn btnPrimary" onClick={handleVerifyCode}>Verify</button>
              </>
            )}
            <div className="small" style={{ marginTop: 10 }}>
              SMS login requires configuring phone auth in Supabase.
            </div>
          </div>
        </div>

        {message && <div className="card" style={{ marginTop: 12 }}><strong>Note:</strong> {message}</div>}

        <div className="card" style={{ marginTop: 12 }}>
          <h3>New user?</h3>
          <div className="small">
            First sign-in automatically creates your profile. You can then choose whether you are a Customer or Partner.
          </div>
          <div style={{ height: 10 }} />
          <Link className="btn" href="/onboarding">Continue to Onboarding</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="nav">
        <div>
          <strong>Southern Values Referral Rewards</strong>
          <div className="small">Signed in as {profile?.email ?? profile?.phone ?? "user"}</div>
        </div>
        <div className="row">
          <Link className="btn" href="/dashboard">Dashboard</Link>
          {profile?.is_admin && <Link className="btn btnWarn" href="/admin">Admin</Link>}
          <Link className="btn" href="/logout">Sign out</Link>
        </div>
      </div>

      <div className="card">
        <h2>Welcome</h2>
        <div className="row">
          <span className="badge">Account: {profile?.account_type}</span>
          {profile?.is_admin && <span className="badge">Admin</span>}
        </div>
        <div style={{ height: 10 }} />
        <div className="small">
          Go to your Dashboard to submit referrals and track earnings/points.
        </div>
        <div style={{ height: 12 }} />
        <Link className="btn btnPrimary" href="/dashboard">Open Dashboard</Link>
      </div>
    </div>
  );
}
