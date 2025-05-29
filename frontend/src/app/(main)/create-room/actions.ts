"use server";

import * as Y from "yjs";
import { z } from "zod";

import { Liveblocks, RoomData } from "@liveblocks/node";

import { createClient } from "@/utils/supabase/server";

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

// --- Form Action for Create Room Page ---
const CreateRoomFormSchema = z.object({
  name: z
    .string()
    .min(3, "Room name must be at least 3 characters long.")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Room name can only contain letters, numbers, underscores, and hyphens."
    ),
  description: z.string().optional(),
  docType: z.enum(["text", "table"], {
    message: "Invalid document type selected.",
  }),
});

export interface HandleCreateRoomFormState {
  success?: boolean;
  message?: string;
  errors?: {
    name?: string[];
    description?: string[];
    docType?: string[];
    _form?: string[]; // For general form errors not tied to a specific field
  };
  createdRoomData?: RoomData; // Optionally return created room data
  documentId?: string; // Add document ID for navigation
}

export async function handleCreateRoomForm(
  prevState: HandleCreateRoomFormState | null,
  formData: FormData
): Promise<HandleCreateRoomFormState> {
  const supabase = await createClient();

  const nameValue = formData.get("name");
  const descriptionValue = formData.get("description");
  const docTypeValue = formData.get("docType");

  const validatedFields = CreateRoomFormSchema.safeParse({
    name: nameValue,
    description: descriptionValue === null ? undefined : descriptionValue,
    docType: docTypeValue,
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { name, docType } = validatedFields.data;
  let supabaseDocId: string | undefined;

  // 1. Create Supabase document record
  try {
    const { data: dbData, error: dbError } = await supabase
      .from("document")
      .insert({ liveblocks_id: name, title: name, type: docType })
      .select("id")
      .single();

    if (dbError || !dbData?.id) {
      console.error("Failed to create document record:", dbError);
      const errorReturn = {
        errors: {
          _form: [
            `Failed to create document record: ${
              dbError?.message ?? "Unknown error"
            }`,
          ],
        },
      };
      console.log(
        ">>> handleCreateRoomForm debug - Supabase error path - returning:",
        JSON.stringify(errorReturn)
      );
      return errorReturn;
    }
    supabaseDocId = dbData.id;
    console.log(
      `Supabase document created with ID: ${supabaseDocId} for Liveblocks room: ${name}`
    );
  } catch (e) {
    const error = e as Error;
    console.error("Unexpected error during Supabase insert:", error);
    return {
      errors: { _form: [`An unexpected error occurred: ${error.message}`] },
    };
  }

  // 2. Create Liveblocks room
  const liveblocksResult = await createLiveblocksRoom(name, docType);

  if (!liveblocksResult.success) {
    // Liveblocks room creation failed, attempt to delete the Supabase document
    if (supabaseDocId) {
      console.warn(
        `Liveblocks room creation failed for ${name}. Attempting to delete Supabase document ID: ${supabaseDocId}`
      );
      const { error: supabaseDeleteError } = await supabase
        .from("document")
        .delete()
        .match({ id: supabaseDocId });

      if (supabaseDeleteError) {
        console.error(
          `Failed to delete Supabase document ${supabaseDocId} after Liveblocks failure:`,
          supabaseDeleteError
        );
        return {
          errors: {
            _form: [
              `${liveblocksResult.error}. Additionally, failed to clean up database record: ${supabaseDeleteError.message}`,
            ],
          },
        };
      }
      console.log(
        `Successfully deleted Supabase document ${supabaseDocId} after Liveblocks failure.`
      );
    }
    return {
      errors: { _form: [liveblocksResult.error] },
    };
  }

  // Both Supabase and Liveblocks creation succeeded
  return {
    success: true,
    message: `Room '${
      liveblocksResult.data.id
    }' (Type: ${docType.toUpperCase()}) and database record created successfully!`,
    createdRoomData: liveblocksResult.data,
    documentId: supabaseDocId,
  };
}

// --- Existing Liveblocks Interaction Functions (getLiveblocksRooms, createLiveblocksRoom, etc.) ---

export async function getLiveblocksRooms(): Promise<GetRoomsResult> {
  // Ensure the secret key is configured
  if (!process.env.LIVEBLOCKS_SECRET_KEY) {
    console.error("LIVEBLOCKS_SECRET_KEY is not set.");
    return { success: false, error: "Server configuration error." };
  }

  try {
    // Fetch rooms using the Node client. It throws on error.
    const roomsPage = await liveblocks.getRooms();

    // Check if roomsPage itself or roomsPage.data is null/undefined
    if (!roomsPage || !roomsPage.data) {
      console.error(
        "Liveblocks getRooms returned unexpected structure or null data:",
        roomsPage
      );
      return {
        success: false,
        error: "Failed to parse rooms data from Liveblocks.",
      };
    }

    // Now it's safe to access roomsPage.data
    const roomsData = roomsPage.data;

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
      firstRow.set("col0", "Hello️ ");
      firstRow.set("col1", "World 🌎");
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
