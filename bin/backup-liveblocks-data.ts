// Run with LIVEBLOCKS_SECRET_KEY=... npx ts-node backup-liveblocks-data.ts

import * as fs from 'fs';
import * as path from 'path';

import { Liveblocks } from '@liveblocks/node';

const liveblocksSecretKey = process.env.LIVEBLOCKS_SECRET_KEY;
if (!liveblocksSecretKey) {
  console.error(
    "Error: LIVEBLOCKS_SECRET_KEY environment variable is not set."
  );
  process.exit(1);
}

const liveblocks = new Liveblocks({
  secret: liveblocksSecretKey,
});

const backupDir = process.env.BACKUP_DIR || "./liveblocks-backup";

async function ensureBackupDirectory() {
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
    console.log(`Created backup directory: ${backupDir}`);
  }
}

async function backupAllYjsData() {
  console.log("Starting Liveblocks YJS data backup...");

  await ensureBackupDirectory();

  try {
    let allRoomsProcessed = false;
    let startingAfter: string | undefined = undefined;
    let roomsBackedUpCount = 0;
    let roomsFailedCount = 0;

    while (!allRoomsProcessed) {
      const { data: rooms, nextCursor } = await liveblocks.getRooms({
        startingAfter,
      });

      if (rooms.length === 0) {
        allRoomsProcessed = true;
        break;
      }

      for (const room of rooms) {
        try {
          console.log(`Backing up room: ${room.id}`);

          // Get the YJS document data
          const yjsData = await liveblocks.getYjsDocumentAsBinaryUpdate(
            room.id
          );

          if (yjsData && yjsData.byteLength > 0) {
            // Convert ArrayBuffer to Uint8Array for proper handling
            const uint8Data = new Uint8Array(yjsData);

            // Create a filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const filename = `${room.id}_${timestamp}.yjs`;
            const filepath = path.join(backupDir, filename);

            // Write the binary data to file
            fs.writeFileSync(filepath, uint8Data);

            // Also save room metadata as JSON
            const metadataFilename = `${room.id}_${timestamp}_metadata.json`;
            const metadataFilepath = path.join(backupDir, metadataFilename);
            fs.writeFileSync(metadataFilepath, JSON.stringify(room, null, 2));

            console.log(
              `Successfully backed up room: ${room.id} (${uint8Data.length} bytes)`
            );
            roomsBackedUpCount++;
          } else {
            console.log(`Room ${room.id} has no YJS data to backup`);
            roomsBackedUpCount++;
          }
        } catch (backupError) {
          console.error(`Failed to backup room ${room.id}:`, backupError);
          roomsFailedCount++;
        }
      }

      if (nextCursor) {
        startingAfter = nextCursor;
      } else {
        allRoomsProcessed = true;
      }
    }

    console.log("\n--- Backup Summary ---");
    console.log(`Backup directory: ${path.resolve(backupDir)}`);
    console.log(`Total rooms backed up: ${roomsBackedUpCount}`);
    console.log(`Total rooms failed: ${roomsFailedCount}`);
    console.log("Finished backing up all rooms.");
  } catch (error) {
    console.error("Failed to fetch or process rooms:", error);
    process.exit(1);
  }
}

backupAllYjsData();
