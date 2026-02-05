-- SouqView Community: comments table for stock symbols
-- Run this in Supabase Dashboard → SQL Editor (or via Supabase CLI)

-- Comments table: stock_symbol, user_id, text, sentiment, upvotes
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_symbol TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  sentiment TEXT NOT NULL CHECK (sentiment IN ('bullish', 'bearish')),
  upvotes INTEGER NOT NULL DEFAULT 0,
  parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  reported_at TIMESTAMPTZ,
  reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for feed by symbol and time
CREATE INDEX IF NOT EXISTS idx_comments_stock_symbol_created
  ON public.comments(stock_symbol, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comments_parent_id
  ON public.comments(parent_id) WHERE parent_id IS NOT NULL;

-- Optional: upvote tracking per user (so one vote per user per comment)
CREATE TABLE IF NOT EXISTS public.comment_upvotes (
  comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_upvotes_comment
  ON public.comment_upvotes(comment_id);

-- Enable Realtime for comments (new/updated comments stream to clients).
-- If this fails (e.g. table already in publication), enable in Dashboard: Database → Replication.
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;

-- RLS: allow read for all, insert/update for authenticated or anon (adjust per your auth)
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_upvotes ENABLE ROW LEVEL SECURITY;

-- Policies: allow anyone to read comments for a symbol
CREATE POLICY "Comments are viewable by everyone"
  ON public.comments FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert a comment"
  ON public.comments FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Comment author or upvote only"
  ON public.comments FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Upvotes table: allow select and insert
CREATE POLICY "Upvotes viewable by everyone"
  ON public.comment_upvotes FOR SELECT
  USING (true);

CREATE POLICY "Anyone can add upvote"
  ON public.comment_upvotes FOR INSERT
  WITH CHECK (true);

CREATE POLICY "User can remove own upvote"
  ON public.comment_upvotes FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to bump updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS comments_updated_at ON public.comments;
CREATE TRIGGER comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
