import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import * as Y from "yjs";

import type { RoomData } from "@liveblocks/node";

// Import the actions module AFTER all mocks and env stubs are set up
import {
  createLiveblocksRoom,
  deleteLiveblocksRoom,
  forkLiveblocksRoom,
  getLiveblocksRooms,
  handleCreateRoomForm,
  nukeAllLiveblocksRooms,
} from "@/app/(main)/create-room/actions";

// Environment stubs (ensure these are at the very top if they affect module imports)
vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test_anon_key");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_API_URL", "http://localhost:54321");
vi.stubEnv("LIVEBLOCKS_SECRET_KEY", "sk_test_liveblocks_secret_key");

// Mock next/headers
const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => mockCookieStore),
}));

// Mock @supabase/ssr
const mockSupabaseFrom = vi.fn();
const mockSupabaseInsert = vi.fn();
const mockSupabaseSelect = vi.fn();
const mockSupabaseSingle = vi.fn();
const mockSupabaseDelete = vi.fn();
const mockSupabaseMatch = vi.fn();

const mockSupabaseClient = {
  from: mockSupabaseFrom,
};
mockSupabaseFrom.mockReturnValue({
  insert: mockSupabaseInsert,
  delete: mockSupabaseDelete,
});
mockSupabaseInsert.mockReturnValue({
  select: mockSupabaseSelect,
});
mockSupabaseSelect.mockReturnValue({
  single: mockSupabaseSingle,
});
mockSupabaseDelete.mockReturnValue({
  match: mockSupabaseMatch,
});

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => mockSupabaseClient),
}));

// Mock AI suggestions
// eslint-disable-next-line no-var
var mockGenerateTableInitialization: ReturnType<typeof vi.fn>;
vi.mock("@/app/(main)/create-room/ai-suggestions", () => {
  const actualMock = vi.fn();
  mockGenerateTableInitialization = actualMock;
  return {
    generateTableInitialization: actualMock,
  };
});

// Declare top-level variables for mock functions using var for hoisting
// eslint-disable-next-line no-var
var mockLiveblocksCreateRoom: ReturnType<typeof vi.fn<() => Promise<RoomData>>>;
// eslint-disable-next-line no-var
var mockLiveblocksSendYjs: ReturnType<typeof vi.fn<() => Promise<void>>>;
// eslint-disable-next-line no-var
var mockLiveblocksDeleteRoom: ReturnType<typeof vi.fn<() => Promise<void>>>;
// eslint-disable-next-line no-var
var mockLiveblocksGetRooms: ReturnType<
  typeof vi.fn<() => Promise<{ data: RoomData[]; nextPage: string | null }>>
>;
// eslint-disable-next-line no-var
var mockLiveblocksGetYjsDoc: ReturnType<
  typeof vi.fn<() => Promise<ArrayBuffer>>
>;

vi.mock("@liveblocks/node", () => {
  // Create NEW mock functions INSIDE the factory
  const actualCreateRoomMock = vi.fn<() => Promise<RoomData>>();
  const actualSendYjsMock = vi.fn<() => Promise<void>>();
  const actualDeleteRoomMock = vi.fn<() => Promise<void>>();
  const actualGetRoomsMock =
    vi.fn<() => Promise<{ data: RoomData[]; nextPage: string | null }>>();
  const actualGetYjsDocMock = vi.fn<() => Promise<ArrayBuffer>>();

  // Assign these new mocks to the outer-scope `var` variables
  mockLiveblocksCreateRoom = actualCreateRoomMock;
  mockLiveblocksSendYjs = actualSendYjsMock;
  mockLiveblocksDeleteRoom = actualDeleteRoomMock;
  mockLiveblocksGetRooms = actualGetRoomsMock;
  mockLiveblocksGetYjsDoc = actualGetYjsDocMock;

  return {
    Liveblocks: vi.fn().mockImplementation(() => ({
      createRoom: actualCreateRoomMock,
      sendYjsBinaryUpdate: actualSendYjsMock,
      deleteRoom: actualDeleteRoomMock,
      getRooms: actualGetRoomsMock,
      getYjsDocumentAsBinaryUpdate: actualGetYjsDocMock,
    })),
    // RoomData is a type, no need to mock its value here
  };
});

// Define Yjs mock instance and its method return values BEFORE vi.mock("yjs", ...)
const mockYDocInstanceGetArrayReturn = {
  push: vi.fn(),
  insert: vi.fn(),
  delete: vi.fn(),
  get: vi.fn(),
  length: 0,
  toArray: vi.fn(() => []),
};
const mockYDocInstanceGetXmlFragmentReturn = {
  insert: vi.fn(),
  delete: vi.fn(),
  get: vi.fn(),
  length: 0,
  toString: vi.fn(() => ""),
};
const mockYDocInstanceGetMapReturn = {
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
  has: vi.fn(() => false),
  size: 0,
  toJSON: vi.fn(() => ({})),
  clear: vi.fn(),
};

// mockYDocInstance holds the spies that will be returned by Y.Doc()
const mockYDocInstance = {
  getArray: vi.fn(() => mockYDocInstanceGetArrayReturn),
  getXmlFragment: vi.fn(() => mockYDocInstanceGetXmlFragmentReturn),
  getMap: vi.fn(() => mockYDocInstanceGetMapReturn),
  transact: vi.fn((fn) => fn()), // Execute the transaction function immediately
  // Add other Y.Doc methods if they are called and need to be mocked
};

vi.mock("yjs", async () => {
  const actualYjs = await vi.importActual<typeof Y>("yjs");
  return {
    ...actualYjs,
    Doc: vi.fn(() => {
      mockYDocInstance.getArray.mockReturnValue(mockYDocInstanceGetArrayReturn);
      mockYDocInstance.getXmlFragment.mockReturnValue(
        mockYDocInstanceGetXmlFragmentReturn
      );
      mockYDocInstance.getMap.mockReturnValue(mockYDocInstanceGetMapReturn);
      return mockYDocInstance;
    }),
    Map: vi.fn(() => mockYDocInstanceGetMapReturn),
    encodeStateAsUpdate: vi.fn(() => new Uint8Array([1, 2, 3])),
    XmlElement: actualYjs.XmlElement,
    XmlText: actualYjs.XmlText,
    Array: actualYjs.Array,
  };
});

describe("Room Creation Actions", () => {
  const originalEnv = { ...process.env }; // Define originalEnv here

  const createMockRoomData = (
    id: string,
    overrides: Partial<RoomData> = {}
  ): RoomData => ({
    id,
    type: "room",
    createdAt: new Date(),
    lastConnectionAt: new Date(),
    defaultAccesses: ["room:write"],
    usersAccesses: {},
    groupsAccesses: {},
    metadata: { name: id },
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test_anon_key",
      NEXT_PUBLIC_SUPABASE_API_URL: "http://localhost:54321",
      LIVEBLOCKS_SECRET_KEY: "sk_test_liveblocks_secret_key",
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      SUPABASE_SERVICE_ROLE_KEY: "test_supabase_service_role_key",
    };
    mockSupabaseMatch.mockResolvedValue({ error: null });

    // Explicitly clear and reset Yjs instance method mocks and their underlying mock functions
    mockYDocInstance.getArray.mockClear();
    mockYDocInstance.getXmlFragment.mockClear();
    mockYDocInstance.getMap.mockClear();
    mockYDocInstance.transact.mockClear();

    mockYDocInstanceGetArrayReturn.push.mockClear();
    mockYDocInstanceGetArrayReturn.insert.mockClear();
    mockYDocInstanceGetArrayReturn.delete.mockClear();
    mockYDocInstanceGetArrayReturn.get.mockClear();
    mockYDocInstanceGetArrayReturn.toArray.mockClear().mockReturnValue([]);

    mockYDocInstanceGetXmlFragmentReturn.insert.mockClear();
    mockYDocInstanceGetXmlFragmentReturn.delete.mockClear();
    mockYDocInstanceGetXmlFragmentReturn.get.mockClear();
    mockYDocInstanceGetXmlFragmentReturn.toString
      .mockClear()
      .mockReturnValue("");

    mockYDocInstanceGetMapReturn.set.mockClear();
    mockYDocInstanceGetMapReturn.get.mockClear();
    mockYDocInstanceGetMapReturn.delete.mockClear();
    mockYDocInstanceGetMapReturn.has.mockClear().mockReturnValue(false);
    mockYDocInstanceGetMapReturn.toJSON.mockClear().mockReturnValue({});
    mockYDocInstanceGetMapReturn.clear.mockClear();

    // Re-assign default return values for the main instance methods,
    // as vi.clearAllMocks() might also clear these if not careful,
    // though typically it only clears call counts/history.
    // This is redundant if Doc factory resets them, but good for safety.
    mockYDocInstance.getArray.mockReturnValue(mockYDocInstanceGetArrayReturn);
    mockYDocInstance.getXmlFragment.mockReturnValue(
      mockYDocInstanceGetXmlFragmentReturn
    );
    mockYDocInstance.getMap.mockReturnValue(mockYDocInstanceGetMapReturn);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("handleCreateRoomForm", () => {
    it("should successfully create a document and a Liveblocks room", async () => {
      const formData = new FormData();
      formData.append("name", "test-room");
      formData.append("description", "A test room");
      formData.append("docType", "text");

      const mockSupabaseDocId = "supabase-doc-uuid";
      mockSupabaseSingle.mockResolvedValueOnce({
        data: { id: mockSupabaseDocId },
        error: null,
      });

      const roomData = createMockRoomData("test-room");
      mockLiveblocksCreateRoom.mockResolvedValueOnce(roomData);
      mockLiveblocksSendYjs.mockResolvedValueOnce(undefined);

      const result = await handleCreateRoomForm(null, formData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.message).toContain(
          "Room 'test-room' (Type: TEXT) and database record created successfully!"
        );
        expect(result.createdRoomData).toEqual(roomData);
        expect(result.documentId).toBe(mockSupabaseDocId);
        // For text documents, AI suggestions are not used
        expect(result.aiSuggestionsUsed).toBeUndefined();
        expect(result.aiSuggestionsError).toBeUndefined();
      }
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("document");
      expect(mockSupabaseInsert).toHaveBeenCalledWith({
        liveblocks_id: "test-room",
        title: "test-room",
        type: "text",
      });
      expect(mockLiveblocksCreateRoom).toHaveBeenCalled();
      expect(mockLiveblocksSendYjs).toHaveBeenCalled();
    });

    it("should return validation errors for invalid form data", async () => {
      const formData = new FormData();
      formData.append("name", "t");
      formData.append("docType", "invalid-type");

      const result = await handleCreateRoomForm(null, formData);

      expect(result.success).toBeUndefined();
      if (!result.success) {
        expect(result.errors?.name).toContain(
          "Room name must be at least 3 characters long."
        );
        expect(result.errors?.docType).toContain(
          "Invalid document type selected."
        );
      }
      expect(mockSupabaseInsert).not.toHaveBeenCalled();
      expect(mockLiveblocksCreateRoom).not.toHaveBeenCalled();
    });

    it("should return an error if Supabase document creation fails", async () => {
      const formData = new FormData();
      formData.append("name", "valid-room-name");
      formData.append("docType", "table");

      const supabaseError = { message: "Supabase insert failed" };
      mockSupabaseSingle.mockResolvedValueOnce({
        data: null,
        error: supabaseError,
      });

      const result = await handleCreateRoomForm(null, formData);

      expect(result.success).toBeUndefined();
      if (!result.success) {
        expect(result.errors).toBeDefined();
        expect(result.errors?._form).toBeDefined();
        expect(result.errors?._form).toBeInstanceOf(Array);
        expect(result.errors?._form).toContain(
          `Failed to create document record: ${supabaseError.message}`
        );
      }
      expect(mockLiveblocksCreateRoom).not.toHaveBeenCalled();
    });

    it("should attempt to delete Supabase doc if Liveblocks creation fails", async () => {
      const formData = new FormData();
      formData.append("name", "good-room");
      formData.append("docType", "text");

      const mockSupabaseDocId = "doc-to-delete-123";
      mockSupabaseSingle.mockResolvedValueOnce({
        data: { id: mockSupabaseDocId },
        error: null,
      });

      const liveblocksErrorMsg = "Liveblocks createRoom failed";
      mockLiveblocksCreateRoom.mockRejectedValueOnce(
        new Error(liveblocksErrorMsg)
      );
      mockSupabaseMatch.mockResolvedValue({ error: null });

      const result = await handleCreateRoomForm(null, formData);

      expect(result.success).toBeUndefined();
      if (!result.success) {
        expect(result.errors?._form).toContain(
          `Could not create room: ${liveblocksErrorMsg}`
        );
      }
      expect(mockSupabaseDelete).toHaveBeenCalledWith();
      expect(mockSupabaseMatch).toHaveBeenCalledWith({ id: mockSupabaseDocId });
    });

    it("should return combined error if Supabase rollback fails after Liveblocks failure", async () => {
      const formData = new FormData();
      formData.append("name", "rollback-fail-room");
      formData.append("docType", "text");

      const mockSupabaseDocId = "doc-rollback-fail-456";
      mockSupabaseSingle.mockResolvedValueOnce({
        data: { id: mockSupabaseDocId },
        error: null,
      });

      const liveblocksErrorMsg = "LB create failed";
      mockLiveblocksCreateRoom.mockRejectedValueOnce(
        new Error(liveblocksErrorMsg)
      );

      const supabaseDeleteErrorMsg = "Supabase delete failed during rollback";
      mockSupabaseMatch.mockResolvedValueOnce({
        error: { message: supabaseDeleteErrorMsg },
      });

      const result = await handleCreateRoomForm(null, formData);

      expect(result.success).toBeUndefined();
      if (!result.success) {
        expect(result.errors?._form).toContain(
          `Could not create room: ${liveblocksErrorMsg}. Additionally, failed to clean up database record: ${supabaseDeleteErrorMsg}`
        );
      }
      expect(mockSupabaseDelete).toHaveBeenCalledTimes(1);
      expect(mockSupabaseMatch).toHaveBeenCalledWith({ id: mockSupabaseDocId });
    });
  });

  describe("createLiveblocksRoom", () => {
    it("should successfully create a Liveblocks room and init Yjs (text)", async () => {
      const roomId = "liveblocks-test-text";
      const roomData = createMockRoomData(roomId);
      mockLiveblocksCreateRoom.mockResolvedValueOnce(roomData);
      mockLiveblocksSendYjs.mockResolvedValueOnce(undefined);

      const result = await createLiveblocksRoom(roomId, "text");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(roomData);
      }
      expect(mockLiveblocksCreateRoom).toHaveBeenCalledWith(roomId, {
        metadata: { name: roomId },
        defaultAccesses: ["room:write"],
      });
      expect(mockLiveblocksSendYjs).toHaveBeenCalledWith(
        roomId,
        expect.any(Uint8Array)
      );
      expect(mockYDocInstance.getXmlFragment).toHaveBeenCalledWith("default");
    });

    it("should successfully create a Liveblocks room and init Yjs (table)", async () => {
      const roomId = "liveblocks-test-table";
      const roomData = createMockRoomData(roomId);
      mockLiveblocksCreateRoom.mockResolvedValueOnce(roomData);
      mockLiveblocksSendYjs.mockResolvedValueOnce(undefined);

      const result = await createLiveblocksRoom(roomId, "table");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(roomData);
      }
      expect(mockLiveblocksCreateRoom).toHaveBeenCalledWith(roomId, {
        metadata: { name: roomId },
        defaultAccesses: ["room:write"],
      });
      expect(mockLiveblocksSendYjs).toHaveBeenCalledWith(
        roomId,
        expect.any(Uint8Array)
      );
      // Expect V2 schema calls
      expect(mockYDocInstance.getMap).toHaveBeenCalledWith("metaData");
      expect(mockYDocInstance.getMap).toHaveBeenCalledWith("columnDefinitions");
      expect(mockYDocInstance.getMap).toHaveBeenCalledWith("rowData");
      expect(mockYDocInstance.getArray).toHaveBeenCalledWith("columnOrder");
      expect(mockYDocInstance.getArray).toHaveBeenCalledWith("rowOrder");
      expect(mockYDocInstance.transact).toHaveBeenCalled();
    });

    it("should use AI suggestions for table initialization when document title is provided", async () => {
      const roomId = "ai-table-test";
      const documentTitle = "Employee Directory";
      const roomData = createMockRoomData(roomId);

      const mockAiSuggestions = {
        primaryColumnName: "Employee ID",
        secondaryColumnName: "Full Name",
        sampleRow: {
          primaryValue: "EMP001",
          secondaryValue: "John Smith",
        },
      };

      mockGenerateTableInitialization.mockResolvedValueOnce(mockAiSuggestions);
      mockLiveblocksCreateRoom.mockResolvedValueOnce(roomData);
      mockLiveblocksSendYjs.mockResolvedValueOnce(undefined);

      const result = await createLiveblocksRoom(roomId, "table", documentTitle);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.aiSuggestionsUsed).toBe(true);
        expect(result.aiSuggestionsError).toBeUndefined();
      }
      expect(mockGenerateTableInitialization).toHaveBeenCalledWith(documentTitle);
      // Expect V2 schema calls
      expect(mockYDocInstance.getMap).toHaveBeenCalledWith("metaData");
      expect(mockYDocInstance.getMap).toHaveBeenCalledWith("columnDefinitions");
      expect(mockYDocInstance.getMap).toHaveBeenCalledWith("rowData");
      expect(mockYDocInstance.getArray).toHaveBeenCalledWith("columnOrder");
      expect(mockYDocInstance.getArray).toHaveBeenCalledWith("rowOrder");
      expect(mockYDocInstance.transact).toHaveBeenCalled();
    });

    it("should fall back to default values when AI suggestions fail", async () => {
      const roomId = "ai-fallback-test";
      const documentTitle = "Test Document";
      const roomData = createMockRoomData(roomId);

      mockGenerateTableInitialization.mockResolvedValueOnce({
        error: "AI service unavailable",
      });
      mockLiveblocksCreateRoom.mockResolvedValueOnce(roomData);
      mockLiveblocksSendYjs.mockResolvedValueOnce(undefined);

      const result = await createLiveblocksRoom(roomId, "table", documentTitle);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.aiSuggestionsUsed).toBe(false);
        expect(result.aiSuggestionsError).toBe("AI service unavailable");
      }
      expect(mockGenerateTableInitialization).toHaveBeenCalledWith(documentTitle);
      // Expect V2 schema calls
      expect(mockYDocInstance.getMap).toHaveBeenCalledWith("metaData");
      expect(mockYDocInstance.getMap).toHaveBeenCalledWith("columnDefinitions");
      expect(mockYDocInstance.getMap).toHaveBeenCalledWith("rowData");
      expect(mockYDocInstance.getArray).toHaveBeenCalledWith("columnOrder");
      expect(mockYDocInstance.getArray).toHaveBeenCalledWith("rowOrder");
      expect(mockYDocInstance.transact).toHaveBeenCalled();
    });

    it("should use fallback values when no document title is provided", async () => {
      const roomId = "no-title-test";
      const roomData = createMockRoomData(roomId);

      mockLiveblocksCreateRoom.mockResolvedValueOnce(roomData);
      mockLiveblocksSendYjs.mockResolvedValueOnce(undefined);

      const result = await createLiveblocksRoom(roomId, "table");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.aiSuggestionsUsed).toBe(false);
        expect(result.aiSuggestionsError).toBeUndefined();
      }
      expect(mockGenerateTableInitialization).not.toHaveBeenCalled();
      // Expect V2 schema calls
      expect(mockYDocInstance.getMap).toHaveBeenCalledWith("metaData");
      expect(mockYDocInstance.getMap).toHaveBeenCalledWith("columnDefinitions");
      expect(mockYDocInstance.getMap).toHaveBeenCalledWith("rowData");
      expect(mockYDocInstance.getArray).toHaveBeenCalledWith("columnOrder");
      expect(mockYDocInstance.getArray).toHaveBeenCalledWith("rowOrder");
      expect(mockYDocInstance.transact).toHaveBeenCalled();
    });

    it("should handle AI suggestions exceptions gracefully", async () => {
      const roomId = "ai-exception-test";
      const documentTitle = "Test Document";
      const roomData = createMockRoomData(roomId);

      mockGenerateTableInitialization.mockRejectedValueOnce(new Error("Network timeout"));
      mockLiveblocksCreateRoom.mockResolvedValueOnce(roomData);
      mockLiveblocksSendYjs.mockResolvedValueOnce(undefined);

      const result = await createLiveblocksRoom(roomId, "table", documentTitle);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.aiSuggestionsUsed).toBe(false);
        expect(result.aiSuggestionsError).toBe("AI service error: Network timeout");
      }
      expect(mockGenerateTableInitialization).toHaveBeenCalledWith(documentTitle);
      // Expect V2 schema calls
      expect(mockYDocInstance.getMap).toHaveBeenCalledWith("metaData");
      expect(mockYDocInstance.getMap).toHaveBeenCalledWith("columnDefinitions");
      expect(mockYDocInstance.getMap).toHaveBeenCalledWith("rowData");
      expect(mockYDocInstance.getArray).toHaveBeenCalledWith("columnOrder");
      expect(mockYDocInstance.getArray).toHaveBeenCalledWith("rowOrder");
      expect(mockYDocInstance.transact).toHaveBeenCalled();
    });

    it("should return error if LIVEBLOCKS_SECRET_KEY is not set", async () => {
      const currentLiveblocksSecret = process.env.LIVEBLOCKS_SECRET_KEY;
      delete process.env.LIVEBLOCKS_SECRET_KEY;
      const result = await createLiveblocksRoom("no-secret-room", "text");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Server configuration error.");
      }
      process.env.LIVEBLOCKS_SECRET_KEY = currentLiveblocksSecret;
    });

    it("should return specific error if Liveblocks createRoom fails (e.g. duplicate ID)", async () => {
      const roomId = "duplicate-room";
      const errorMessage = "Room with id 'duplicate-room' already exists.";
      mockLiveblocksCreateRoom.mockRejectedValueOnce(new Error(errorMessage));

      const result = await createLiveblocksRoom(roomId, "text");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(
          `Room ID '${roomId}' already exists. Try a different name.`
        );
      }
      expect(mockLiveblocksDeleteRoom).not.toHaveBeenCalled();
    });

    it("should attempt cleanup if sendYjsBinaryUpdate fails", async () => {
      const roomId = "yjs-fail-room";
      const roomData = createMockRoomData(roomId);
      mockLiveblocksCreateRoom.mockResolvedValueOnce(roomData);

      const yjsErrorMessage = "Failed to send Yjs update";
      mockLiveblocksSendYjs.mockRejectedValueOnce(new Error(yjsErrorMessage));
      mockLiveblocksDeleteRoom.mockResolvedValueOnce(undefined);

      const result = await createLiveblocksRoom(roomId, "text");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(
          `Created room, but failed to set default content: ${yjsErrorMessage}`
        );
      }
      expect(mockLiveblocksDeleteRoom).toHaveBeenCalledWith(roomId);
    });

    it("should return combined error if cleanup fails after sendYjsBinaryUpdate failure", async () => {
      const roomId = "yjs-fail-cleanup-fail-room";
      const roomData = createMockRoomData(roomId);
      mockLiveblocksCreateRoom.mockResolvedValueOnce(roomData);

      const yjsErrorMessage = "Yjs init failed horribly";
      mockLiveblocksSendYjs.mockRejectedValueOnce(new Error(yjsErrorMessage));

      const deleteErrorMessage = "Failed to delete room during cleanup";
      mockLiveblocksDeleteRoom.mockRejectedValueOnce(
        new Error(deleteErrorMessage)
      );

      const result = await createLiveblocksRoom(roomId, "text");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(
          `Created room, but failed to set default content: ${yjsErrorMessage}`
        );
      }
      expect(mockLiveblocksDeleteRoom).toHaveBeenCalledWith(roomId);
    });
  });

  describe("getLiveblocksRooms", () => {
    it("should return rooms successfully when Liveblocks API call succeeds", async () => {
      const mockRoomsData = [
        createMockRoomData("room1"),
        createMockRoomData("room2"),
      ];
      mockLiveblocksGetRooms.mockResolvedValueOnce({
        data: mockRoomsData,
        nextPage: null,
      });

      const result = await getLiveblocksRooms();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockRoomsData);
      }
      expect(mockLiveblocksGetRooms).toHaveBeenCalledTimes(1);
    });

    it("should return an error if LIVEBLOCKS_SECRET_KEY is not set", async () => {
      const currentLiveblocksSecret = process.env.LIVEBLOCKS_SECRET_KEY;
      delete process.env.LIVEBLOCKS_SECRET_KEY;
      const result = await getLiveblocksRooms();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Server configuration error.");
      }
      expect(mockLiveblocksGetRooms).not.toHaveBeenCalled();
      process.env.LIVEBLOCKS_SECRET_KEY = currentLiveblocksSecret;
    });

    it("should return an error if Liveblocks API call fails", async () => {
      const errorMessage = "Failed to fetch from Liveblocks API";
      mockLiveblocksGetRooms.mockRejectedValueOnce(new Error(errorMessage));

      const result = await getLiveblocksRooms();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(errorMessage);
      }
      expect(mockLiveblocksGetRooms).toHaveBeenCalledTimes(1);
    });

    it("should return an error if Liveblocks API response is not as expected", async () => {
      mockLiveblocksGetRooms.mockResolvedValueOnce(
        null as unknown as { data: RoomData[]; nextPage: string | null }
      );

      const resultNullData = await getLiveblocksRooms();
      expect(resultNullData.success).toBe(false);
      if (!resultNullData.success) {
        expect(resultNullData.error).toBe(
          "Failed to parse rooms data from Liveblocks."
        );
      }
      mockLiveblocksGetRooms.mockClear();
      mockLiveblocksGetRooms.mockResolvedValueOnce({
        data: null,
        nextPage: null,
      } as unknown as { data: RoomData[]; nextPage: string | null });
      const resultNullDataProperty = await getLiveblocksRooms();
      expect(resultNullDataProperty.success).toBe(false);
      if (!resultNullDataProperty.success) {
        expect(resultNullDataProperty.error).toBe(
          "Failed to parse rooms data from Liveblocks."
        );
      }
    });
  });

  describe("forkLiveblocksRoom", () => {
    const originalRoomId = "original-room-to-fork";
    const newRoomId = "new-forked-room";
    const mockOriginalYjsData = new Uint8Array([1, 2, 3, 4, 5]);
    const newForkedRoomData = createMockRoomData(newRoomId);

    it("should successfully fork a room", async () => {
      mockLiveblocksGetYjsDoc.mockResolvedValueOnce(mockOriginalYjsData.buffer);
      mockLiveblocksCreateRoom.mockResolvedValueOnce(newForkedRoomData);
      mockLiveblocksSendYjs.mockResolvedValueOnce(undefined);

      const result = await forkLiveblocksRoom(originalRoomId, newRoomId);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(newForkedRoomData);
      }
      expect(mockLiveblocksGetYjsDoc).toHaveBeenCalledWith(originalRoomId);
      expect(mockLiveblocksCreateRoom).toHaveBeenCalledWith(newRoomId, {
        metadata: { name: newRoomId },
        defaultAccesses: ["room:write"],
      });
      expect(mockLiveblocksSendYjs).toHaveBeenCalledWith(
        newRoomId,
        mockOriginalYjsData
      );
    });

    it("should return error if LIVEBLOCKS_SECRET_KEY is not set", async () => {
      const currentLiveblocksSecret = process.env.LIVEBLOCKS_SECRET_KEY;
      delete process.env.LIVEBLOCKS_SECRET_KEY;
      const result = await forkLiveblocksRoom(originalRoomId, newRoomId);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Server configuration error.");
      }
      process.env.LIVEBLOCKS_SECRET_KEY = currentLiveblocksSecret;
    });

    it("should return error if getting original Yjs data fails", async () => {
      const errorMsg = "Failed to get original Yjs data";
      mockLiveblocksGetYjsDoc.mockRejectedValueOnce(new Error(errorMsg));

      const result = await forkLiveblocksRoom(originalRoomId, newRoomId);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(
          `Could not read original room data: ${errorMsg}`
        );
      }
    });

    it("should return error if creating the new room fails (e.g., duplicate ID)", async () => {
      mockLiveblocksGetYjsDoc.mockResolvedValueOnce(mockOriginalYjsData.buffer);
      const errorMsg = "Room with id 'new-forked-room' already exists.";
      mockLiveblocksCreateRoom.mockRejectedValueOnce(new Error(errorMsg));

      const result = await forkLiveblocksRoom(originalRoomId, newRoomId);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(
          `Room ID '${newRoomId}' already exists. Try a different name.`
        );
      }
    });

    it("should return error if creating the new general room fails", async () => {
      mockLiveblocksGetYjsDoc.mockResolvedValueOnce(mockOriginalYjsData.buffer);
      const errorMsg = "Some other creation error";
      mockLiveblocksCreateRoom.mockRejectedValueOnce(new Error(errorMsg));

      const result = await forkLiveblocksRoom(originalRoomId, newRoomId);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(`Could not create new room: ${errorMsg}`);
      }
    });

    it("should attempt cleanup if sending Yjs data to new room fails", async () => {
      mockLiveblocksGetYjsDoc.mockResolvedValueOnce(mockOriginalYjsData.buffer);
      mockLiveblocksCreateRoom.mockResolvedValueOnce(newForkedRoomData);
      const errorMsg = "Failed to send Yjs data to new room";
      mockLiveblocksSendYjs.mockRejectedValueOnce(new Error(errorMsg));
      mockLiveblocksDeleteRoom.mockResolvedValueOnce(undefined);

      const result = await forkLiveblocksRoom(originalRoomId, newRoomId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(
          `Created room, but failed to copy content: ${errorMsg}`
        );
      }
      expect(mockLiveblocksDeleteRoom).toHaveBeenCalledWith(newRoomId);
    });

    it("should include cleanup error in log if cleanup fails after Yjs send failure", async () => {
      mockLiveblocksGetYjsDoc.mockResolvedValueOnce(mockOriginalYjsData.buffer);
      mockLiveblocksCreateRoom.mockResolvedValueOnce(newForkedRoomData);
      const sendErrorMsg = "Yjs send failed for fork";
      mockLiveblocksSendYjs.mockRejectedValueOnce(new Error(sendErrorMsg));
      const deleteErrorMsg = "Cleanup delete failed for fork";
      mockLiveblocksDeleteRoom.mockRejectedValueOnce(new Error(deleteErrorMsg));
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await forkLiveblocksRoom(originalRoomId, newRoomId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(
          `Created room, but failed to copy content: ${sendErrorMsg}`
        );
      }
      expect(mockLiveblocksDeleteRoom).toHaveBeenCalledWith(newRoomId);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Failed to cleanup room ${newRoomId} after Yjs init error:`,
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe("nukeAllLiveblocksRooms", () => {
    it("should successfully delete all rooms when rooms exist", async () => {
      const mockRooms = [
        createMockRoomData("room-to-nuke-1"),
        createMockRoomData("room-to-nuke-2"),
      ];
      mockLiveblocksGetRooms.mockResolvedValueOnce({
        data: mockRooms,
        nextPage: null,
      });
      mockLiveblocksDeleteRoom.mockResolvedValue(undefined);

      const result = await nukeAllLiveblocksRooms();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.deletedCount).toBe(mockRooms.length);
        expect(result.errors).toEqual([]);
      }
      expect(mockLiveblocksGetRooms).toHaveBeenCalledTimes(1);
      expect(mockLiveblocksDeleteRoom).toHaveBeenCalledTimes(mockRooms.length);
      expect(mockLiveblocksDeleteRoom).toHaveBeenCalledWith(mockRooms[0].id);
      expect(mockLiveblocksDeleteRoom).toHaveBeenCalledWith(mockRooms[1].id);
    });

    it("should return success with 0 deleted if no rooms exist", async () => {
      mockLiveblocksGetRooms.mockResolvedValueOnce({
        data: [],
        nextPage: null,
      });
      const result = await nukeAllLiveblocksRooms();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.deletedCount).toBe(0);
        expect(result.errors).toEqual([]);
      }
      expect(mockLiveblocksDeleteRoom).not.toHaveBeenCalled();
    });

    it("should return error if LIVEBLOCKS_SECRET_KEY is not set", async () => {
      const currentLiveblocksSecret = process.env.LIVEBLOCKS_SECRET_KEY;
      delete process.env.LIVEBLOCKS_SECRET_KEY;
      const result = await nukeAllLiveblocksRooms();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Server configuration error.");
        expect(result.deletedCount).toBe(0);
      }
      process.env.LIVEBLOCKS_SECRET_KEY = currentLiveblocksSecret;
    });

    it("should return error if fetching room list fails", async () => {
      const errorMsg = "Failed to get room list for nuke";
      mockLiveblocksGetRooms.mockRejectedValueOnce(new Error(errorMsg));
      const result = await nukeAllLiveblocksRooms();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(`Failed to get room list: ${errorMsg}`);
        expect(result.deletedCount).toBe(0);
      }
    });

    it("should report errors for rooms that fail to delete but continue deleting others", async () => {
      const mockRoomsList = [
        createMockRoomData("nuke-ok-1"),
        createMockRoomData("nuke-fail-1"),
        createMockRoomData("nuke-ok-2"),
      ];
      mockLiveblocksGetRooms.mockResolvedValueOnce({
        data: mockRoomsList,
        nextPage: null,
      });

      const deleteErrorMsg = "Specific delete failed";
      mockLiveblocksDeleteRoom
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error(deleteErrorMsg))
        .mockResolvedValueOnce(undefined);

      const result = await nukeAllLiveblocksRooms();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.deletedCount).toBe(2);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toEqual({
          roomId: "nuke-fail-1",
          error: deleteErrorMsg,
        });
      }
      expect(mockLiveblocksDeleteRoom).toHaveBeenCalledTimes(3);
    });
  });

  describe("deleteLiveblocksRoom", () => {
    const roomIdToDelete = "room-to-delete-individually";

    it("should successfully delete a specific room", async () => {
      mockLiveblocksDeleteRoom.mockResolvedValueOnce(undefined);
      const result = await deleteLiveblocksRoom(roomIdToDelete);

      expect(result.success).toBe(true);
      expect(mockLiveblocksDeleteRoom).toHaveBeenCalledWith(roomIdToDelete);
    });

    it("should return error if LIVEBLOCKS_SECRET_KEY is not set", async () => {
      const currentLiveblocksSecret = process.env.LIVEBLOCKS_SECRET_KEY;
      delete process.env.LIVEBLOCKS_SECRET_KEY;
      const result = await deleteLiveblocksRoom(roomIdToDelete);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Server configuration error.");
      }
      process.env.LIVEBLOCKS_SECRET_KEY = currentLiveblocksSecret;
    });

    it("should return error if roomId is not provided", async () => {
      const result = await deleteLiveblocksRoom("");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Room ID is required.");
      }
      expect(mockLiveblocksDeleteRoom).not.toHaveBeenCalled();
    });

    it("should return error if Liveblocks API call to delete fails", async () => {
      const errorMsg = "Failed to delete from Liveblocks API";
      mockLiveblocksDeleteRoom.mockRejectedValueOnce(new Error(errorMsg));
      const result = await deleteLiveblocksRoom(roomIdToDelete);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(errorMsg);
      }
      expect(mockLiveblocksDeleteRoom).toHaveBeenCalledWith(roomIdToDelete);
    });
  });
});
