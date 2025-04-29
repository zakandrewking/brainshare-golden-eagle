"use server"; // Mark this module as containing Server Actions

import * as Y from "yjs"; // Import yjs

import { Liveblocks, RoomData } from "@liveblocks/node";

// Export RoomData type
export type { RoomData };

/*
// Remove the custom interface, use RoomData directly
export interface LiveblocksRoomData {
// ... removed interface ...
}
*/

// Define the possible return types for the action using RoomData
interface ActionResultSuccess {
  success: true;
  data: RoomData[];
}
interface ActionResultError {
  success: false;
  error: string;
}
type GetRoomsResult = ActionResultSuccess | ActionResultError;

// Type for create room action result
interface CreateRoomResultSuccess {
  success: true;
  data: RoomData; // Return the created room data
}
interface CreateRoomResultError {
  success: false;
  error: string;
}
type CreateRoomResult = CreateRoomResultSuccess | CreateRoomResultError;

// Type for fork room action result (same success shape as create)
interface ForkRoomResultSuccess {
  success: true;
  data: RoomData; // Return the forked room data
}
interface ForkRoomResultError {
  success: false;
  error: string;
}
type ForkRoomResult = ForkRoomResultSuccess | ForkRoomResultError;

// Type for nuke action result
interface NukeRoomsResultSuccess {
  success: true;
  deletedCount: number;
  errors: { roomId: string; error: string }[]; // Report errors for specific rooms
}
interface NukeRoomsResultError {
  success: false;
  error: string; // General error (e.g., fetching list failed)
  deletedCount: number; // Still report rooms deleted before failure
}
type NukeRoomsResult = NukeRoomsResultSuccess | NukeRoomsResultError;

// Type for delete room action result
interface DeleteRoomResultSuccess {
  success: true;
}
interface DeleteRoomResultError {
  success: false;
  error: string;
}
type DeleteRoomResult = DeleteRoomResultSuccess | DeleteRoomResultError;

// Initialize Liveblocks Node client
const liveblocks = new Liveblocks({
  secret: process.env.LIVEBLOCKS_SECRET_KEY!,
});

export async function getLiveblocksRooms(): Promise<GetRoomsResult> {
  // Ensure the secret key is configured
  if (!process.env.LIVEBLOCKS_SECRET_KEY) {
    console.error("LIVEBLOCKS_SECRET_KEY is not set.");
    return { success: false, error: "Server configuration error." };
  }

  try {
    // Fetch rooms using the Node client. It throws on error.
    const roomsPage = await liveblocks.getRooms();

    // Assuming roomsPage has a 'data' property containing the array of rooms
    // Adjust if the structure is different (e.g., roomsPage.data or just roomsPage)
    const roomsData = roomsPage.data;

    if (!roomsData) {
      console.error(
        "Liveblocks getRooms returned unexpected structure:",
        roomsPage
      );
      return {
        success: false,
        error: "Failed to parse rooms data from Liveblocks.",
      };
    }

    // Return the data directly without casting
    return { success: true, data: roomsData };
  } catch (err: unknown) {
    console.error("Liveblocks getRooms failed:", err);
    return {
      success: false,
      error: (err as Error).message || "Failed to fetch rooms from Liveblocks.",
    };
  }
}

// Function to create a room
export async function createLiveblocksRoom(
  roomId: string,
  docType: "text" | "table"
): Promise<CreateRoomResult> {
  if (!process.env.LIVEBLOCKS_SECRET_KEY) {
    console.error("LIVEBLOCKS_SECRET_KEY is not set.");
    return { success: false, error: "Server configuration error." };
  }

  let newRoom: RoomData;
  try {
    // 1. Create the room metadata
    newRoom = await liveblocks.createRoom(roomId, {
      metadata: {
        name: roomId,
      },
      defaultAccesses: ["room:write"],
    });
  } catch (err: unknown) {
    console.error("Liveblocks createRoom failed:", err);
    // Handle potential duplicate room ID error specifically if needed
    if (
      (err as Error).message &&
      (err as Error).message.includes("already exists")
    ) {
      return {
        success: false,
        error: `Room ID '${roomId}' already exists. Try a different name.`,
      };
    }
    return {
      success: false,
      error: `Could not create room: ${(err as Error).message}`,
    };
  }

  // 2. Create default Yjs content and send initial update
  try {
    const yDoc = new Y.Doc();

    // Conditional seeding based on docType
    if (docType === "table") {
      // Create a Y.Array named 'tableData' to represent the table rows
      const yTable = yDoc.getArray<Y.Map<unknown>>("tableData");
      // Create the first row as a Y.Map
      const firstRow = new Y.Map<unknown>();
      // Set the value of the first cell (column 'col0')
      firstRow.set("col0", "Hello World 🌎️");
      // Add the first row to the table array
      yTable.push([firstRow]);
    } else {
      // Default to text seeding (original logic)
      const yXmlFragment = yDoc.getXmlFragment("default");
      const paragraph = new Y.XmlElement("paragraph");
      paragraph.insert(0, [new Y.XmlText("Hello World 🌎️")]); // Keep emoji here too?
      yXmlFragment.insert(0, [paragraph]);
    }

    // Encode the state as an update message
    const yUpdate = Y.encodeStateAsUpdate(yDoc);

    // Initialize the Yjs document with the default content
    await liveblocks.sendYjsBinaryUpdate(roomId, yUpdate);

    // Return the created room data (metadata)
    return { success: true, data: newRoom };
  } catch (err: unknown) {
    console.error(`Failed to initialize Yjs data for new room ${roomId}:`, err);
    // Attempt to clean up the created room if initialization fails
    try {
      await liveblocks.deleteRoom(roomId);
      console.log(
        `Cleaned up room ${roomId} after Yjs initialization failure.`
      );
    } catch (deleteErr) {
      console.error(
        `Failed to cleanup room ${roomId} after Yjs init error:`,
        deleteErr
      );
    }
    return {
      success: false,
      error: `Created room, but failed to set default content: ${
        (err as Error).message
      }`,
    };
  }
}

// NEW: Function to fork a room
export async function forkLiveblocksRoom(
  originalRoomId: string,
  newRoomId: string
): Promise<ForkRoomResult> {
  if (!process.env.LIVEBLOCKS_SECRET_KEY) {
    console.error("LIVEBLOCKS_SECRET_KEY is not set.");
    return { success: false, error: "Server configuration error." };
  }

  let originalYjsDataBuffer: ArrayBuffer;

  // 1. Get Yjs data from the original room
  try {
    originalYjsDataBuffer = await liveblocks.getYjsDocumentAsBinaryUpdate(
      originalRoomId
    );
  } catch (err: unknown) {
    console.error(`Failed to get Yjs data for room ${originalRoomId}:`, err);
    return {
      success: false,
      error: `Could not read original room data: ${(err as Error).message}`,
    };
  }

  // Convert ArrayBuffer to Uint8Array
  const originalYjsDataUint8 = new Uint8Array(originalYjsDataBuffer);

  // 2. Create the new room
  let newRoom: RoomData;
  try {
    newRoom = await liveblocks.createRoom(newRoomId, {
      metadata: {
        name: newRoomId,
      },
      defaultAccesses: ["room:write"],
    });
  } catch (err: unknown) {
    console.error(`Failed to create new room ${newRoomId}:`, err);
    if (
      (err as Error).message &&
      (err as Error).message.includes("already exists")
    ) {
      return {
        success: false,
        error: `Room ID '${newRoomId}' already exists. Try a different name.`,
      };
    }
    return {
      success: false,
      error: `Could not create new room: ${(err as Error).message}`,
    };
  }

  // 3. Initialize the new room's Yjs document with the original data
  try {
    // Use sendYjsBinaryUpdate to initialize the state
    await liveblocks.sendYjsBinaryUpdate(newRoomId, originalYjsDataUint8);

    return { success: true, data: newRoom };
  } catch (err: unknown) {
    console.error(
      `Failed to initialize Yjs data for new room ${newRoomId}:`,
      err
    );
    // Attempt to clean up the created room if initialization fails
    try {
      await liveblocks.deleteRoom(newRoomId);
      console.log(
        `Cleaned up room ${newRoomId} after Yjs initialization failure.`
      );
    } catch (deleteErr) {
      console.error(
        `Failed to cleanup room ${newRoomId} after Yjs init error:`,
        deleteErr
      );
    }
    return {
      success: false,
      error: `Created room, but failed to copy content: ${
        (err as Error).message
      }`,
    };
  }
}

// NEW: Function to delete all rooms
export async function nukeAllLiveblocksRooms(): Promise<NukeRoomsResult> {
  if (!process.env.LIVEBLOCKS_SECRET_KEY) {
    console.error("LIVEBLOCKS_SECRET_KEY is not set.");
    return {
      success: false,
      error: "Server configuration error.",
      deletedCount: 0,
    };
  }

  let allRooms: RoomData[] = [];
  try {
    // Attempt to fetch rooms - assuming getRooms fetches all or enough for typical use cases.
    // If pagination is needed, this part needs refinement.
    const roomsPage = await liveblocks.getRooms();
    if (!roomsPage || !roomsPage.data) {
      throw new Error(
        "Failed to fetch rooms or received invalid data structure."
      );
    }
    allRooms = roomsPage.data;
  } catch (err: unknown) {
    console.error("Failed to fetch list of rooms to nuke:", err);
    return {
      success: false,
      error: `Failed to get room list: ${(err as Error).message}`,
      deletedCount: 0,
    };
  }

  if (allRooms.length === 0) {
    return { success: true, deletedCount: 0, errors: [] }; // Nothing to delete
  }

  console.log(`Attempting to delete ${allRooms.length} rooms...`);
  let deletedCount = 0;
  const errors: { roomId: string; error: string }[] = [];

  // Delete rooms sequentially for safer error handling
  for (const room of allRooms) {
    try {
      await liveblocks.deleteRoom(room.id);
      console.log(`Deleted room: ${room.id}`);
      deletedCount++;
    } catch (err: unknown) {
      console.error(`Failed to delete room ${room.id}:`, err);
      errors.push({
        roomId: room.id,
        error: (err as Error).message || "Unknown deletion error",
      });
    }
  }

  console.log(
    `Nuke complete. Deleted: ${deletedCount}, Errors: ${errors.length}`
  );
  return { success: true, deletedCount, errors };
}

// NEW: Function to delete a single room
export async function deleteLiveblocksRoom(
  roomId: string
): Promise<DeleteRoomResult> {
  if (!process.env.LIVEBLOCKS_SECRET_KEY) {
    console.error("LIVEBLOCKS_SECRET_KEY is not set.");
    return { success: false, error: "Server configuration error." };
  }

  if (!roomId) {
    return { success: false, error: "Room ID is required." };
  }

  try {
    console.log(`Attempting to delete room: ${roomId}`);
    await liveblocks.deleteRoom(roomId);
    console.log(`Successfully deleted room: ${roomId}`);
    return { success: true };
  } catch (err: unknown) {
    console.error(`Failed to delete room ${roomId}:`, err);
    // Handle specific errors like "not found" if necessary
    return {
      success: false,
      error: (err as Error).message || `Failed to delete room ${roomId}.`,
    };
  }
}
