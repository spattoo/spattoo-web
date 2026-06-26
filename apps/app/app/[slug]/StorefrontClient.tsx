"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CustomerStorefront } from "@spattoo/designer";
import { getSupabase } from "../../lib/supabase";
import { API_BASE } from "../../lib/api";

// Mounts the core CustomerStorefront and routes its callbacks. The whole journey
// stays on this origin (the baker's subdomain) so the Supabase session set during
// the invite OTP login persists into the designer.
export default function StorefrontClient({ slug }: { slug: string }) {
  const router = useRouter();
  const inviteId = useSearchParams().get("invite");
  const supabase = getSupabase();

  return (
    <CustomerStorefront
      slug={slug}
      inviteId={inviteId}
      apiBaseUrl={API_BASE}
      supabase={supabase}
      // After OTP login (session is set), or a browse "start designing", go to the
      // designer on this same origin.
      onAuthenticated={() => router.push(`/${slug}/design`)}
      onStartDesign={() => router.push(`/${slug}/design`)}
    />
  );
}
