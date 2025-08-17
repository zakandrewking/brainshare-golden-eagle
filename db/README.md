# dev workflow

First `cd db`.

Make edits to /db/schema/*.ts, and then run to sync with the local db:

```bash
npx drizzle-kit push
```

When ready, generate migrations for the postgres database:

```bash
npx drizzle-kit generate
```

Test locally:

```bash
supabase start
supabase db reset
```

Then push to production:

```bash
supabase link # first time only
supabase db push
```

## Debugging

If realtime broadcast for db changes is not working, check that the Database
Publication `supabase_realtime_messages_publication` is enabled for Insert.
