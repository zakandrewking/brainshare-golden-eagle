import * as fs from 'fs';
import * as path from 'path';
import * as Y from 'yjs';

import { Liveblocks } from '@liveblocks/node';
import { DocConnection, DocumentManager } from '@y-sweet/sdk';

const liveblocksSecretKey = process.env.LIVEBLOCKS_SECRET_KEY;
const ysweetConnectionString = process.env.YSWEET_CONNECTION_STRING;

if (!liveblocksSecretKey) {
  console.error(
    "Error: LIVEBLOCKS_SECRET_KEY environment variable is not set."
  );
  process.exit(1);
}

if (!ysweetConnectionString) {
  console.error(
    "Error: YSWEET_CONNECTION_STRING environment variable is not set."
  );
  console.error(
    "Example: YSWEET_CONNECTION_STRING=ys://your-ysweet-server.com"
  );
  process.exit(1);
}

const liveblocks = new Liveblocks({
  secret: liveblocksSecretKey,
});

const documentManager = new DocumentManager(ysweetConnectionString);

const logDir = process.env.LOG_DIR || "./migration-logs";

async function ensureLogDirectory() {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
    console.log(`Created log directory: ${logDir}`);
  }
}

interface MigrationLog {
  timestamp: string;
  liveblocksRoomId: string;
  ysweetDocId: string;
  status: "success" | "failed" | "skipped";
  error?: string;
  dataSize?: number;
}

const migrationLogs: MigrationLog[] = [];

async function createYSweetDocument(docId: string): Promise<boolean> {
  try {
    console.log(`Creating YSweet document: ${docId}`);

    await documentManager.createDoc(docId);
    console.log(`Created YSweet document: ${docId}`);
    return true;
  } catch (error) {
    console.error(`Error creating YSweet document ${docId}:`, error);
    return false;
  }
}

async function uploadYjsDataToYSweet(
  docId: string,
  yDocUpdate: Y.Doc
): Promise<boolean> {
  try {
    console.log(`Uploading YJS data to YSweet document: ${docId}`);

    const token = await documentManager.getClientToken(docId);
    const newToken = {
      ...token,
      url: token.url.replace("ws://", "wss://"),
      baseUrl: token.baseUrl.replace("http://", "https://"),
    };
    const yjsData = Y.encodeStateAsUpdate(yDocUpdate);
    const connection = new DocConnection(newToken);
    await connection.updateDoc(yjsData);

    console.log(
      `Successfully uploaded YJS data to YSweet document: ${docId} (${yjsData.length} bytes)`
    );
    return true;
  } catch (error) {
    console.error(`Error uploading YJS data to ${docId}:`, error);
    return false;
  }
}

async function migrateRoom(room: any): Promise<MigrationLog> {
  const timestamp = new Date().toISOString();
  const log: MigrationLog = {
    timestamp,
    liveblocksRoomId: room.id,
    ysweetDocId: room.id, // Use same ID for simplicity, could be customized
    status: "failed",
  };

  try {
    console.log(`\nMigrating room: ${room.id}`);

    // Get YJS data from Liveblocks
    const yjsData = await liveblocks.getYjsDocumentAsBinaryUpdate(room.id);

    if (!yjsData || yjsData.byteLength === 0) {
      console.log(`Room ${room.id} has no YJS data to migrate`);
      log.status = "skipped";
      log.error = "No YJS data";
      return log;
    }

    log.dataSize = yjsData.byteLength;

    // Create YSweet document
    const documentCreated = await createYSweetDocument(log.ysweetDocId);
    if (!documentCreated) {
      log.error = "Failed to create YSweet document";
      return log;
    }

    // Upload YJS data to YSweet
    const yDoc = new Y.Doc();
    Y.applyUpdate(yDoc, new Uint8Array(yjsData));

    const dataUploaded = await uploadYjsDataToYSweet(log.ysweetDocId, yDoc);
    if (!dataUploaded) {
      log.error = "Failed to upload YJS data";
      return log;
    }

    log.status = "success";
    console.log(`✅ Successfully migrated room: ${room.id}`);
    return log;
  } catch (error) {
    console.error(`❌ Failed to migrate room ${room.id}:`, error);
    log.error = error instanceof Error ? error.message : String(error);
    return log;
  }
}

async function saveMigrationLogs() {
  await ensureLogDirectory();

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logFilename = `migration-log-${timestamp}.json`;
  const logFilepath = path.join(logDir, logFilename);

  fs.writeFileSync(logFilepath, JSON.stringify(migrationLogs, null, 2));
  console.log(`\nMigration log saved to: ${logFilepath}`);
}

async function migrateAllRooms(isSingleRoom = false) {
  console.log("Starting Liveblocks to YSweet migration...");
  console.log(`Source: Liveblocks`);
  console.log(`Destination: ${ysweetConnectionString}`);

  try {
    let allRoomsProcessed = false;
    let startingAfter: string | undefined = undefined;
    let roomsSuccessCount = 0;
    let roomsFailedCount = 0;
    let roomsSkippedCount = 0;

    while (!allRoomsProcessed) {
      const { data: rooms, nextCursor } = await liveblocks.getRooms({
        startingAfter,
      });

      if (rooms.length === 0) {
        allRoomsProcessed = true;
        break;
      }

      for (const room of rooms) {
        const log = await migrateRoom(room);
        migrationLogs.push(log);

        switch (log.status) {
          case "success":
            roomsSuccessCount++;
            break;
          case "failed":
            roomsFailedCount++;
            break;
          case "skipped":
            roomsSkippedCount++;
            break;
        }
        if (isSingleRoom) {
          break;
        }
      }

      if (isSingleRoom) {
        break;
      }

      if (nextCursor) {
        startingAfter = nextCursor;
      } else {
        allRoomsProcessed = true;
      }
    }

    await saveMigrationLogs();

    console.log("\n=== Migration Summary ===");
    console.log(
      `Total rooms processed: ${
        roomsSuccessCount + roomsFailedCount + roomsSkippedCount
      }`
    );
    console.log(`✅ Successfully migrated: ${roomsSuccessCount}`);
    console.log(`⏭️  Skipped (no data): ${roomsSkippedCount}`);
    console.log(`❌ Failed: ${roomsFailedCount}`);

    if (roomsFailedCount > 0) {
      console.log("\n❌ Failed rooms:");
      migrationLogs
        .filter((log) => log.status === "failed")
        .forEach((log) => {
          console.log(`  - ${log.liveblocksRoomId}: ${log.error}`);
        });
    }

    console.log("\nMigration completed!");

    if (roomsFailedCount > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Failed to fetch or process rooms:", error);
    await saveMigrationLogs();
    process.exit(1);
  }
}

// Add CLI argument parsing for dry run mode
const isDryRun = process.argv.includes("--dry-run");
const isSingleRoom = process.argv.includes("--single-room");

if (isDryRun) {
  console.log("🔍 DRY RUN MODE - No actual migration will be performed");
  console.log("This will only list the rooms that would be migrated\n");
}

async function dryRun() {
  console.log("Starting dry run - listing Liveblocks rooms...");

  try {
    let allRoomsProcessed = false;
    let startingAfter: string | undefined = undefined;
    let totalRooms = 0;
    let totalDataSize = 0;

    while (!allRoomsProcessed) {
      const { data: rooms, nextCursor } = await liveblocks.getRooms({
        startingAfter,
      });

      if (rooms.length === 0) {
        allRoomsProcessed = true;
        break;
      }

      for (const room of rooms) {
        totalRooms++;
        console.log(`📋 Room: ${room.id}`);

        try {
          const yjsData = await liveblocks.getYjsDocumentAsBinaryUpdate(
            room.id
          );
          if (yjsData && yjsData.byteLength > 0) {
            totalDataSize += yjsData.byteLength;
            console.log(`   Data size: ${yjsData.byteLength} bytes`);
          } else {
            console.log(`   No YJS data`);
          }
        } catch (error) {
          console.log(`   Error reading data: ${error}`);
        }
      }

      if (nextCursor) {
        startingAfter = nextCursor;
      } else {
        allRoomsProcessed = true;
      }
    }

    console.log("\n=== Dry Run Summary ===");
    console.log(`Total rooms found: ${totalRooms}`);
    console.log(
      `Total data size: ${(totalDataSize / 1024 / 1024).toFixed(2)} MB`
    );
    console.log(
      "\nTo perform the actual migration, run without --dry-run flag"
    );
  } catch (error) {
    console.error("Failed to perform dry run:", error);
    process.exit(1);
  }
}

if (isDryRun) {
  dryRun();
} else {
  migrateAllRooms(isSingleRoom);
}
