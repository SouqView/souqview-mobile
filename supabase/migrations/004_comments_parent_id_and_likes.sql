-- Fix missing columns for replies and likes on comments.
-- Run in Supabase Dashboard → SQL Editor (or via Supabase CLI).

-- Fix Missing Column for Replies (threaded comments)
ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE;

-- Fix Missing Column for Likes (if you haven't added it yet)
ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0;

-- Optional: index for fetching replies by parent
CREATE INDEX IF NOT EXISTS idx_comments_parent_id
  ON public.comments(parent_id) WHERE parent_id IS NOT NULL;
