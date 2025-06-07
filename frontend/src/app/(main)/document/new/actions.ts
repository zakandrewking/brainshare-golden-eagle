"use server";

import * as Y from "yjs";
import { z } from "zod";

import { Liveblocks, RoomData } from "@liveblocks/node";

import { createClient } from "@/utils/supabase/server";

import { generateTableInitialization } from "./ai-suggestions";

interface ActionResultSuccess {
  success: true;
  data: RoomData[];
}
interface ActionResultError {
  success: false;
  error: string;
}
type GetRoomsResult = ActionResultSuccess | ActionResultError;

// Type for create document action result
interface CreateRoomResultSuccess {
  success: true;
  data: RoomData; // Return the created room data
  aiSuggestionsUsed?: boolean; // Whether AI suggestions were successfully used
  aiSuggestionsError?: string; // Error message if AI suggestions failed
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

// --- Form Action for Create Document Page ---
const CreateRoomFormSchema = z.object({
  name: z.string().trim().min(1, "Document name cannot be empty."),
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
  aiSuggestionsUsed?: boolean; // Whether AI suggestions were successfully used
  aiSuggestionsError?: string; // Error message if AI suggestions failed
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
      .insert({
        liveblocks_id: name,
        title: name,
        type: docType,
        description: descriptionValue?.toString(),
      })
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
  const liveblocksResult = await createLiveblocksRoom(
    name,
    docType,
    name,
    descriptionValue?.toString()
  );

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
    aiSuggestionsUsed: liveblocksResult.aiSuggestionsUsed,
    aiSuggestionsError: liveblocksResult.aiSuggestionsError,
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
  docType: "text" | "table",
  documentTitle: string,
  documentDescription?: string
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
      error: `Could not create document: ${(err as Error).message}`,
    };
  }

  // 2. Create default Yjs content and send initial update
  try {
    const yDoc = new Y.Doc();
    let aiSuggestionsUsed: boolean | undefined;
    let aiSuggestionsError: string | undefined;

    if (docType === "table") {
      // Use V2 schema for new tables
      const yMeta = yDoc.getMap<unknown>("metaData");
      const yColumnDefinitions = yDoc.getMap<{
        id: string;
        name: string;
        width: number;
      }>("columnDefinitions");
      const yColumnOrder = yDoc.getArray<string>("columnOrder");
      const yRowData = yDoc.getMap<Y.Map<string>>("rowData");
      const yRowOrder = yDoc.getArray<string>("rowOrder");

      let primaryColumnName = "Item";
      let secondaryColumnName = "Description";
      let primaryValue = "Sample Item";
      let secondaryValue = "Sample Description";

      try {
        if (documentTitle && documentTitle.trim().length > 0) {
          const aiSuggestions = await generateTableInitialization(
            documentTitle,
            documentDescription ?? ""
          );

          if (aiSuggestions.error) {
            aiSuggestionsUsed = false;
            aiSuggestionsError = aiSuggestions.error;
            console.warn(
              `AI suggestions failed: ${aiSuggestions.error}. Using fallback data.`
            );
          } else {
            aiSuggestionsUsed = true;
            primaryColumnName = aiSuggestions.primaryColumnName || "Item";
            secondaryColumnName =
              aiSuggestions.secondaryColumnName || "Description";
            primaryValue =
              aiSuggestions.sampleRow?.primaryValue || "Sample Item";
            secondaryValue =
              aiSuggestions.sampleRow?.secondaryValue || "Sample Description";
          }
        } else {
          aiSuggestionsUsed = false;
        }
      } catch (aiError) {
        aiSuggestionsUsed = false;
        aiSuggestionsError = `AI service error: ${(aiError as Error).message}`;
        console.warn(`AI suggestions error: ${aiError}. Using fallback data.`);
      }

      // Create V2 schema data
      yDoc.transact(() => {
        // Set schema version
        yMeta.set("schemaVersion", 2);

        // Create column definitions
        const col1Id = crypto.randomUUID();
        const col2Id = crypto.randomUUID();

        yColumnDefinitions.set(col1Id, {
          id: col1Id,
          name: primaryColumnName,
          width: 150,
        });

        yColumnDefinitions.set(col2Id, {
          id: col2Id,
          name: secondaryColumnName,
          width: 150,
        });

        // Set column order
        yColumnOrder.push([col1Id, col2Id]);

        // Create initial row
        const rowId = crypto.randomUUID();
        const rowMap = new Y.Map<string>();
        rowMap.set(col1Id, primaryValue);
        rowMap.set(col2Id, secondaryValue);
        yRowData.set(rowId, rowMap);

        // Set row order
        yRowOrder.push([rowId]);
      });
    } else {
      // For text documents, AI suggestions are not applicable
      const yXmlFragment = yDoc.getXmlFragment("default");
      const paragraph = new Y.XmlElement("paragraph");
      paragraph.insert(0, [new Y.XmlText("Hello World 🌎️")]);
      yXmlFragment.insert(0, [paragraph]);
    }

    const yUpdate = Y.encodeStateAsUpdate(yDoc);
    await liveblocks.sendYjsBinaryUpdate(roomId, yUpdate);

    return {
      success: true,
      data: newRoom,
      aiSuggestionsUsed,
      aiSuggestionsError,
    };
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
