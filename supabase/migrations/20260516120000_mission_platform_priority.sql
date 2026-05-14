-- Optional classification for mission board filters (client already exists on mission_cards).

ALTER TABLE public.mission_cards
  ADD COLUMN IF NOT EXISTS platform TEXT,
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium';

COMMENT ON COLUMN public.mission_cards.platform IS 'Ad platform hint, e.g. meta_ads, google_ads — optional.';
COMMENT ON COLUMN public.mission_cards.priority IS 'Work priority: low | medium | high | critical.';
