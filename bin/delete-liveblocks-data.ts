#!/usr/bin/env ts-node

// Run with LIVEBLOCKS_SECRET_KEY=... bin/delete-liveblocks-data.ts

import { Liveblocks } from '@liveblocks/node';

const liveblocksSecretKey = process.env.LIVEBLOCKS_SECRET_KEY;
if (!liveblocksSecretKey) {
  console.error("Error: LIVEBLOCKS_SECRET_KEY environment variable is not set.");
  process.exit(1);
}

const liveblocks = new Liveblocks({
  secret: liveblocksSecretKey,
});

const roomsToKeep: string[] = ["planet-editor", "moons"];

async function deleteAllYjsDataExcept() {
  console.log("Fetching all rooms...");
  try {
    let allRoomsProcessed = false;
    let startingAfter: string | undefined = undefined;
    let roomsDeletedCount = 0;
    let roomsKeptCount = 0;

    while (!allRoomsProcessed) {
      const { data: rooms, nextCursor } = await liveblocks.getRooms({ startingAfter });

      if (rooms.length === 0) {
        allRoomsProcessed = true;
        break;
      }

      for (const room of rooms) {
        if (roomsToKeep.includes(room.id)) {
          console.log(`Keeping room: ${room.id}`);
          roomsKeptCount++;
        } else {
          try {
            console.log(`Deleting Yjs data for room: ${room.id}`);
            await liveblocks.deleteRoom(room.id);
            console.log(`Successfully deleted room: ${room.id}`);
            roomsDeletedCount++;
          } catch (deleteError) {
            console.error(`Failed to delete room ${room.id}:`, deleteError);
          }
        }
      }

      if (nextCursor) {
        startingAfter = nextCursor;
      } else {
        allRoomsProcessed = true;
      }
    }
    console.log("\n--- Deletion Summary ---");
    console.log(`Total rooms kept: ${roomsKeptCount}`);
    console.log(`Total rooms deleted: ${roomsDeletedCount}`);
    console.log("Finished processing all rooms.");

  } catch (error) {
    console.error("Failed to fetch or process rooms:", error);
    process.exit(1);
  }
}

deleteAllYjsDataExcept();
