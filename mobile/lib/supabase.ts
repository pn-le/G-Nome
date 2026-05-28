import { createClient } from "@supabase/supabase-js";

// Make sure to remove /rest/v1/ from the URL if it was provided
const supabaseUrl = "https://jnuagbsnsvhytqffjhkt.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpudWFnYnNuc3ZoeXRxZmZqaGt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MDM0NDUsImV4cCI6MjA5NTQ3OTQ0NX0.b4SZpOuUtyFsx_dmiHTMwQhKVp2QIpqWseDfYUG9asg";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
