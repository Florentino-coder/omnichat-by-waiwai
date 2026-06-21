import "@testing-library/jest-dom";
import { randomUUID } from "node:crypto";

if (typeof window !== "undefined") {
  if (!window.crypto) {
    (window as any).crypto = {};
  }
  if (!window.crypto.randomUUID) {
    window.crypto.randomUUID = randomUUID;
  }
}

if (typeof global !== "undefined") {
  if (!global.crypto) {
    (global as any).crypto = {};
  }
  if (!global.crypto.randomUUID) {
    global.crypto.randomUUID = randomUUID;
  }
}

