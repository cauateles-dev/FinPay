import { createClient } from '@supabase/supabase-js';

const meta = import.meta as any;
const supabaseUrl = (meta.env?.NEXT_PUBLIC_SUPABASE_URL as string) || 'https://nnzeoqxpgusducyagamd.supabase.co';
const supabaseAnonKey = (meta.env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string) || 'sb_publishable_7uBGI9K5_W2nDKKrOTyb3w_XyM7ld0g';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
