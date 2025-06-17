# Liveblocks to YSweet Migration Script

This script migrates YJS document data from Liveblocks to YSweet using the official Y-Sweet SDK.

## Prerequisites

1. Install dependencies:
   ```bash
   cd bin
   npm install
   ```

2. Set up environment variables:
   - `LIVEBLOCKS_SECRET_KEY`: Your Liveblocks secret key
   - `YSWEET_CONNECTION_STRING`: Your YSweet connection string (e.g., `ys://your-ysweet-server.com` or `yss://your-ysweet-server.com` for SSL)

### Optional Environment Variables

- `LOG_DIR`: Directory for migration logs (default: `./migration-logs`)

## Usage

### Dry Run (Recommended First)

To see what would be migrated without actually performing the migration:

```bash
LIVEBLOCKS_SECRET_KEY=your_key YSWEET_CONNECTION_STRING=ys://your-ysweet-server.com npx ts-node migrate-liveblocks-to-ysweet.ts --dry-run
```

### Actual Migration

```bash
LIVEBLOCKS_SECRET_KEY=your_key YSWEET_CONNECTION_STRING=ys://your-ysweet-server.com npx ts-node migrate-liveblocks-to-ysweet.ts
```

## How it Works

1. **Fetch Rooms**: Retrieves all rooms from Liveblocks using the API
2. **Extract YJS Data**: Downloads the binary YJS document update for each room
3. **Create YSweet Documents**: Creates corresponding documents in YSweet with the same IDs using the Y-Sweet SDK
4. **Upload Data**: Applies the YJS updates to the YSweet documents using the SDK
5. **Logging**: Saves detailed logs of the migration process

## Migration Logs

The script creates detailed logs in JSON format with:
- Timestamp of each migration attempt
- Source Liveblocks room ID
- Target YSweet document ID
- Status (success/failed/skipped)
- Error messages (if any)
- Data size migrated

## Y-Sweet SDK Integration

This script uses the official `@y-sweet/sdk` package which provides:
- `DocumentManager.createDoc(docId)` - Create a new document
- `DocumentManager.updateDoc(docId, updateData)` - Apply YJS binary update to a document
- Automatic authentication and error handling
- Connection string support for easy configuration

## Connection String Format

The Y-Sweet connection string should follow this format:
- `ys://your-server.com` for non-SSL connections
- `yss://your-server.com` for SSL connections
- Include authentication tokens in the connection string as needed

## Error Handling

- Rooms with no YJS data are skipped
- Failed migrations are logged but don't stop the process
- The script exits with code 1 if any migrations fail
- All progress is saved to logs for troubleshooting

## Data Validation

The script validates YJS data by:
1. Checking that data exists and has non-zero size
2. Applying the update to a temporary Y.Doc to ensure it's valid
3. Only uploading data that passes validation

## Troubleshooting

1. **Authentication Errors**: Verify your LIVEBLOCKS_SECRET_KEY and YSWEET_CONNECTION_STRING
2. **Network Errors**: Check your YSWEET_CONNECTION_STRING and network connectivity
3. **API Errors**: Check the migration logs for detailed error messages
4. **Rate Limiting**: The script processes rooms sequentially to avoid overwhelming APIs

## Example Output

```
Starting Liveblocks to YSweet migration...
Source: Liveblocks
Destination: ys://your-ysweet-server.com

Migrating room: room-1
Creating YSweet document: room-1
Created YSweet document: room-1
Uploading YJS data to YSweet document: room-1
Successfully uploaded YJS data to YSweet document: room-1 (1024 bytes)
✅ Successfully migrated room: room-1

=== Migration Summary ===
Total rooms processed: 5
✅ Successfully migrated: 4
⏭️  Skipped (no data): 1
❌ Failed: 0

Migration completed!
