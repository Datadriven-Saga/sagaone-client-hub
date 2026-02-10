import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ENCRYPTION_KEY = Deno.env.get("MFA_ENCRYPTION_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Simple AES-GCM encryption/decryption using Web Crypto API
async function getKey(): Promise<CryptoKey> {
  const keyData = new TextEncoder().encode(ENCRYPTION_KEY.padEnd(32, "0").slice(0, 32));
  return crypto.subtle.importKey("raw", keyData, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encrypt(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  // Combine iv + ciphertext, encode as base64
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decrypt(encryptedBase64: string): Promise<string> {
  const key = await getKey();
  const combined = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

function getUserFromAuth(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  try {
    const token = authHeader.replace("Bearer ", "");
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub || null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create authenticated client to verify token
    const authHeader = req.headers.get("authorization") || "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Verify token and get user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // LIST - Get all user's MFA accounts (decrypt secrets)
    if (req.method === "GET" && action === "list") {
      const { data, error } = await supabase
        .from("mfa_accounts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Decrypt secrets before sending to client
      const decrypted = await Promise.all(
        (data || []).map(async (acc: any) => {
          try {
            const secret = await decrypt(acc.secret_encrypted);
            return { ...acc, secret, secret_encrypted: undefined };
          } catch {
            // If decryption fails, it might be a legacy unencrypted secret
            return { ...acc, secret: acc.secret_encrypted, secret_encrypted: undefined };
          }
        })
      );

      return new Response(JSON.stringify(decrypted), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CREATE - Add new MFA account (encrypt secret)
    if (req.method === "POST" && action === "create") {
      const body = await req.json();
      const { id, issuer, label, secret, algorithm, digits, period } = body;

      if (!secret || !issuer) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const encryptedSecret = await encrypt(secret);

      const { data, error } = await supabase.from("mfa_accounts").insert({
        id: id || `mfa-${Date.now()}`,
        issuer,
        label: label || issuer,
        secret_encrypted: encryptedSecret,
        algorithm: algorithm || "SHA1",
        digits: digits || 6,
        period: period || 30,
        user_id: userId,
        created_by: userId,
      }).select().single();

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, id: data.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // UPDATE - Rename account
    if (req.method === "PUT" && action === "update") {
      const body = await req.json();
      const { id, issuer, label } = body;

      const { error } = await supabase
        .from("mfa_accounts")
        .update({ issuer, label, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE - Remove account and recovery codes
    if (req.method === "DELETE" && action === "delete") {
      const accountId = url.searchParams.get("id");
      if (!accountId) {
        return new Response(JSON.stringify({ error: "Missing account id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delete recovery codes first
      await supabase
        .from("mfa_recovery_codes")
        .delete()
        .eq("account_id", accountId)
        .eq("user_id", userId);

      // Delete account
      const { error } = await supabase
        .from("mfa_accounts")
        .delete()
        .eq("id", accountId)
        .eq("user_id", userId);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // MIGRATE - Encrypt existing plaintext secrets for this user
    if (req.method === "POST" && action === "migrate-encrypt") {
      const { data, error } = await supabase
        .from("mfa_accounts")
        .select("id, secret_encrypted")
        .eq("user_id", userId);

      if (error) throw error;

      let migrated = 0;
      for (const acc of data || []) {
        // Check if it's already encrypted (base64 with specific pattern)
        try {
          await decrypt(acc.secret_encrypted);
          // Already encrypted, skip
          continue;
        } catch {
          // Not encrypted, encrypt it
          const encrypted = await encrypt(acc.secret_encrypted);
          await supabase
            .from("mfa_accounts")
            .update({ secret_encrypted: encrypted })
            .eq("id", acc.id)
            .eq("user_id", userId);
          migrated++;
        }
      }

      return new Response(JSON.stringify({ success: true, migrated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("MFA error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
