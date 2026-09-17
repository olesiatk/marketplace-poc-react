import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Unmounts every component rendered by a test so the next test's render()
// doesn't accumulate leftover DOM from the previous one.
afterEach(cleanup);
