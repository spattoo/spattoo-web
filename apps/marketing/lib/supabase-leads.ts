import { createClient } from "@supabase/supabase-js";

export const supabaseLeads = createClient(
  "https://opuonrvfhaguesykycqb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wdW9ucnZmaGFndWVzeWt5Y3FiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NTE2MjUsImV4cCI6MjA5NDUyNzYyNX0.aSEVfbVcPG3E1V0C9AhdvOwe9zH33eb643aYT4wxGuw"
);
