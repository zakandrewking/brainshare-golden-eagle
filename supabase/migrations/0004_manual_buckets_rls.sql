CREATE POLICY "Authenticated user can manage their own objects" ON storage.objects
    FOR ALL TO authenticated
        USING (bucket_id = 'files'
            AND auth.uid() = owner_id::uuid)
            WITH CHECK (bucket_id = 'files'
            AND auth.uid() = owner_id::uuid);

