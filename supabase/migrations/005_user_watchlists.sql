-- SouqView: User Watchlists (per-user saved symbols)
-- Run in Supabase Dashboard → SQL Editor (or: supabase db push)

CREATE TABLE IF NOT EXISTS public.user_watchlists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Prevent duplicate symbols for the same user
  UNIQUE (user_id, symbol)
);

CREATE INDEX IF NOT EXISTS idx_user_watchlists_user_id
  ON public.user_watchlists(user_id);

CREATE INDEX IF NOT EXISTS idx_user_watchlists_symbol
  ON public.user_watchlists(symbol);

ALTER TABLE public.user_watchlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own watchlist"
  ON public.user_watchlists FOR SELECT
  USING ( auth.uid() = user_id );

CREATE POLICY "Users can add to their watchlist"
  ON public.user_watchlists FOR INSERT
  WITH CHECK ( auth.uid() = user_id );

CREATE POLICY "Users can delete from their watchlist"
  ON public.user_watchlists FOR DELETE
  USING ( auth.uid() = user_id );
