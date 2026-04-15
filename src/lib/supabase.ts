import { createClient } from '@supabase/supabase-js';

const SB_URL = 'https://wwhjwowkxwvnthmpvkjm.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3aGp3b3dreHd2bnRobXB2a2ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NjA1OTMsImV4cCI6MjA5MTMzNjU5M30.CTXqLIuc_Q9e4g1sijWIwYnlRo3daHAnDOq1TMDMh5Y';

export const supabase = createClient(SB_URL, SB_KEY);

export async function sbGet<T>(table: string, filters: Record<string, string> = {}): Promise<T[]> {
  let req = supabase.from(table).select('*');
  for (const [col, raw] of Object.entries(filters)) {
    const [op, val] = raw.split('.', 2);
    if (op === 'eq')   req = (req as any).eq(col, val);
    if (op === 'neq')  req = (req as any).neq(col, val);
    if (op === 'gte')  req = (req as any).gte(col, val);
    if (op === 'lte')  req = (req as any).lte(col, val);
    if (op === 'like') req = (req as any).like(col, val);
  }
  const { data, error } = await req;
  if (error) throw new Error(error.message);
  return data as T[];
}

export async function sbPost<T>(table: string, payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.from(table).insert(payload).select().single();
  if (error) throw new Error(error.message);
  return data as T;
}

export async function sbPatch<T>(table: string, id: string, payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.from(table).update(payload).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data as T;
}
