CREATE POLICY status_read_authenticated ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'status');
CREATE POLICY status_insert_own ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'status' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY status_update_own ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'status' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'status' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY status_delete_own ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'status' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY wallpapers_read_own ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'wallpapers' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY wallpapers_insert_own ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'wallpapers' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY wallpapers_update_own ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'wallpapers' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'wallpapers' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY wallpapers_delete_own ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'wallpapers' AND (storage.foldername(name))[1] = auth.uid()::text);
