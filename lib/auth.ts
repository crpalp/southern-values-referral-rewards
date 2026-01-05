import { supabase } from "@/lib/supabaseClient";

export async function signInWithEmail(email: string) {
  return supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
  });
}

export async function signInWithPhone(phone: string) {
  // Supabase phone auth uses OTP SMS provider configured in Supabase
  return supabase.auth.signInWithOtp({ phone });
}

export async function verifyPhoneOtp(phone: string, token: string) {
  return supabase.auth.verifyOtp({ phone, token, type: "sms" });
}

export async function signOut() {
  return supabase.auth.signOut();
}
