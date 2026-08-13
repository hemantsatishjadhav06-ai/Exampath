"use client";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

/** Fire-and-forget page-view logging (RLS allows public INSERT only). */
export default function TrackView({ entityType, entityId }: { entityType: "exam_cycle" | "body"; entityId: string }) {
  useEffect(() => {
    if (!supabase) return;
    supabase.from("page_views").insert({ entity_type: entityType, entity_id: entityId }).then(() => {});
  }, [entityType, entityId]);
  return null;
}
