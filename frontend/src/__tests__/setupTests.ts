import "@testing-library/jest-dom/vitest";

import { afterEach, vi } from "vitest";

import { cleanup } from "@testing-library/react";

// Globally stub environment variables for all test files
vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test_global_anon_key");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_API_URL", "http://localhost:54321/global");
vi.stubEnv("LIVEBLOCKS_SECRET_KEY", "sk_test_global_liveblocks_secret_key");

afterEach(() => {
  cleanup();
});
