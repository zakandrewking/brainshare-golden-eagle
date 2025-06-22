/**
 * Y-Sweet server actions for the document/new page.
 */

"use server";

import * as Y from "yjs";
import z from "zod";

import { DocConnection, DocumentManager } from "@y-sweet/sdk";

import { generateTableInitialization } from "@/app/(main)/document/new/ai-suggestions";
import { createClient } from "@/utils/supabase/server";

const CreateYSweetDocumentFormSchema = z.object({
  name: z.string().trim().min(1, "Document name cannot be empty."),
  description: z.string().optional(),
  docType: z.enum(["text", "table"], {
    message: "Invalid document type selected.",
  }),
});

export interface CreateYSweetDocumentFormState {
  success?: boolean;
  message?: string;
  errors?: {
    name?: string[];
    description?: string[];
    docType?: string[];
    _form?: string[];
  };
  createdDocumentData?: { id: string; title: string };
  documentId?: string;
  aiSuggestionsUsed?: boolean;
  aiSuggestionsError?: string;
}

// Function to create a Y-Sweet document with initial content
export async function createYSweetDocument(
  _prevState: CreateYSweetDocumentFormState | null,
  formData: FormData
): Promise<CreateYSweetDocumentFormState> {
  if (!process.env.Y_SWEET_CONNECTION_STRING) {
    console.error("Y_SWEET_CONNECTION_STRING is not set.");
    return {
      errors: {
        _form: ["Server configuration error."],
      },
    };
  }
  const documentManager = new DocumentManager(
    process.env.Y_SWEET_CONNECTION_STRING
  );

  const supabase = await createClient();

  const nameValue = formData.get("name");
  const descriptionValue = formData.get("description");
  const docTypeValue = formData.get("docType");

  const validatedFields = CreateYSweetDocumentFormSchema.safeParse({
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
  let ySweetDocId: string | undefined;

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
      .select("id, ysweet_id")
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
    ySweetDocId = dbData.ysweet_id ?? undefined;
    console.log(
      `Supabase document created with ID: ${supabaseDocId} for Y-Sweet document: ${ySweetDocId}`
    );
  } catch (e) {
    const error = e as Error;
    console.error("Unexpected error during Supabase insert:", error);
    return {
      errors: { _form: [`An unexpected error occurred: ${error.message}`] },
    };
  }

  if (!ySweetDocId) {
    return {
      errors: { _form: ["Failed to create Y-Sweet document."] },
    };
  }

  // 2. Create the Y-Sweet document
  try {
    await documentManager.createDoc(ySweetDocId);
    console.log(`Created Y-Sweet document: ${ySweetDocId}`);
  } catch (err: unknown) {
    console.error("Y-Sweet createDoc failed:", err);
    // Handle potential duplicate document ID error specifically if needed
    if (
      (err as Error).message &&
      (err as Error).message.includes("already exists")
    ) {
      return {
        success: false,
        errors: {
          _form: [
            `Document ID '${ySweetDocId}' already exists. Try a different name.`,
          ],
        },
      };
    }
    return {
      success: false,
      errors: {
        _form: [`Could not create document: ${(err as Error).message}`],
      },
    };
  }

  // 3. Initialize the document with default content
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
        if (name && name.trim().length > 0) {
          const aiSuggestions = await generateTableInitialization(
            name,
            descriptionValue?.toString() ?? ""
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

    // Upload the initial content to Y-Sweet
    const token = await documentManager.getClientToken(ySweetDocId);
    const newToken = {
      ...token,
      url: token.url.replace("ws://", "wss://"),
      baseUrl: token.baseUrl.replace("http://", "https://"),
    };
    const connection = new DocConnection(newToken);
    const yUpdate = Y.encodeStateAsUpdate(yDoc);
    await connection.updateDoc(yUpdate);

    console.log(`Successfully initialized Y-Sweet document: ${ySweetDocId}`);

    return {
      success: true,
      createdDocumentData: { id: supabaseDocId, title: name },
      documentId: supabaseDocId,
      aiSuggestionsUsed,
      aiSuggestionsError,
    };
  } catch (err: unknown) {
    console.error(`Failed to initialize Y-Sweet document ${ySweetDocId}:`, err);
    // Y-Sweet doesn't have a direct "delete document" API, but we can try to clean up
    // by not returning success - the caller will handle cleanup
    return {
      success: false,
      errors: {
        _form: [
          `Created document, but failed to set default content: ${
            (err as Error).message
          }`,
        ],
      },
    };
  }
}
