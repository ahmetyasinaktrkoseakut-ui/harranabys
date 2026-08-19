-- Migration: Add unique constraint on public.puko_degerlendirmeleri (alt_olcut_id, puko_asamasi, donem_id)
-- This enables bulk upserting on natural key without referencing identity column 'id'

ALTER TABLE public.puko_degerlendirmeleri
DROP CONSTRAINT IF EXISTS puko_degerlendirmeleri_unique_olcut_asamasi_donem;

ALTER TABLE public.puko_degerlendirmeleri
ADD CONSTRAINT puko_degerlendirmeleri_unique_olcut_asamasi_donem
UNIQUE (alt_olcut_id, puko_asamasi, donem_id);
