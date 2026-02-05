-- SouqView – Stock sentiment votes (Bulls/Bears) + comment downvotes.
-- Run in Supabase Dashboard → SQL Editor.

-- 1) Stock-level vote: one vote per user per symbol (Bullish or Bearish)
CREATE TABLE IF NOT EXISTS public.stock_votes (
  stock_symbol TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote TEXT NOT NULL CHECK (vote IN ('bullish', 'bearish')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (stock_symbol, user_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_votes_symbol ON public.stock_votes(stock_symbol);

ALTER TABLE public.stock_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read stock votes" ON public.stock_votes;
CREATE POLICY "Anyone can read stock votes"
  ON public.stock_votes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own vote" ON public.stock_votes;
CREATE POLICY "Users can insert own vote"
  ON public.stock_votes FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own vote" ON public.stock_votes;
CREATE POLICY "Users can update own vote"
  ON public.stock_votes FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Allow anonymous: use a nullable user_id or a separate anon table. For now require user_id.
-- If you need anonymous votes, add a policy that allows INSERT with user_id = null and use a device_id column instead.

-- 2) Add downvotes to comments (for upvote/downvote arrows)
ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS downvotes INTEGER NOT NULL DEFAULT 0;
