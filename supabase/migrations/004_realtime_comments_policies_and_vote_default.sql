-- SouqView: Realtime for Chat, Comment RLS, and Vote default
-- Run in Supabase Dashboard → SQL Editor (or: supabase db push)

-- 1. Enable Realtime for Chat (messages appear instantly)
-- If this errors with "already a member of publication", Realtime is already enabled for comments.
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;

-- 2. Security: Allow anyone to read comments, but only authenticated users to post
-- Drop existing policies if they exist (from 001_comments.sql)
DROP POLICY IF EXISTS "Comments are viewable by everyone" ON public.comments;
DROP POLICY IF EXISTS "Anyone can insert a comment" ON public.comments;

CREATE POLICY "Public comments are viewable by everyone"
  ON public.comments FOR SELECT
  USING ( true );

CREATE POLICY "Users can insert their own comments"
  ON public.comments FOR INSERT
  WITH CHECK ( auth.uid() = user_id );

-- 3. Fix the 'Vote' column: allow 'neutral' and default to neutral
-- Allow 'neutral' in the check, then set default (required for new rows / upserts)
ALTER TABLE public.stock_votes
  DROP CONSTRAINT IF EXISTS stock_votes_vote_check;

ALTER TABLE public.stock_votes
  ADD CONSTRAINT stock_votes_vote_check
  CHECK ( vote IN ('bullish', 'bearish', 'neutral') );

ALTER TABLE public.stock_votes
  ALTER COLUMN vote SET DEFAULT 'neutral';
