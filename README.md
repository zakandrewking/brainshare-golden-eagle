# Run locally

Tasks (in `.vscode/tasks.json`) to start a local instance:
- `[supabase] start`
- `[inngest] dev`
- [ ] need a local y-sweet server task

Debug configurations (in `.vscode/launch.json`):
- `Frontend` - runs against all local services
- `Frontend (prod db)` - runs against the production database, but otherwise
  local services (local inngest)

NOTE: Currently, both of those configurations run against the production y-sweet
server.

# Deploy

To sync config:

```bash
supabase link
```

Manual steps for the production server:
- set realtime settings to disable public access

# Seed production

To create storage buckets in the production instance, run:


```bash
npx supabase seed buckets --linked
```

See https://github.com/orgs/supabase/discussions/12390#discussioncomment-10260149
