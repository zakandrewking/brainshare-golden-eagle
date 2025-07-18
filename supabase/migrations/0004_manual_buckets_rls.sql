CREATE POLICY "Authenticated user can create objects" ON storage.objects
    FOR INSERT TO authenticated
        WITH CHECK (bucket_id = 'files');

CREATE POLICY "Authenticated user can manage their own objects" ON storage.objects
    FOR ALL TO authenticated
        USING (bucket_id = 'files'
            AND (
                SELECT
                    auth.uid()) = owner_id::uuid);

