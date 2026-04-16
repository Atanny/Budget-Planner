-- Add receipt_url column to monthly_payments if it doesn't exist
ALTER TABLE monthly_payments ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- Create receipts storage bucket (run in Supabase Dashboard > Storage if not created)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', true)
-- ON CONFLICT (id) DO NOTHING;

-- Storage policies for receipts bucket
-- Allow authenticated users to upload their own receipts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can upload own receipts'
  ) THEN
    CREATE POLICY "Users can upload own receipts" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can view own receipts'
  ) THEN
    CREATE POLICY "Users can view own receipts" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Public read receipts'
  ) THEN
    CREATE POLICY "Public read receipts" ON storage.objects
      FOR SELECT TO public
      USING (bucket_id = 'receipts');
  END IF;
END $$;
