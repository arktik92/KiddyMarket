// Session token management shared by the AuthContext (writer) and the API
// client (reader). One key, one in-memory copy, one unauthorized handler.
import { storage } from "@/src/utils/storage";

export const SESSION_KEY = "kiddy_session_token";

let inMemory: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(fn: (() => void) | null) {
  unauthorizedHandler = fn;
}

export function triggerUnauthorized() {
  if (unauthorizedHandler) unauthorizedHandler();
}

export function getToken(): string | null {
  return inMemory;
}

export async function loadToken(): Promise<string | null> {
  inMemory = await storage.secureGet(SESSION_KEY, "");
  if (!inMemory) inMemory = null;
  return inMemory;
}

export async function saveToken(token: string): Promise<void> {
  inMemory = token;
  await storage.secureSet(SESSION_KEY, token);
}

export async function clearToken(): Promise<void> {
  inMemory = null;
  await storage.secureRemove(SESSION_KEY);
}
