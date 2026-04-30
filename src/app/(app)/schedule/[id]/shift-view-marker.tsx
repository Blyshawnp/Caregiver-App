"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Sets the shift's first_viewed_at to now() the first time the caregiver
 * loads the shift detail page. Idempotent server-side: the RPC only writes
 * if first_viewed_at is currently null and the user is the assigned caregiver.
 *
 * Renders nothing.
 */
export default function ShiftViewMarker({ shiftId }: { shiftId: string }) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    const supabase = createClient();
    void supabase.rpc("mark_shift_viewed", { p_shift_id: shiftId });
  }, [shiftId]);

  return null;
}
