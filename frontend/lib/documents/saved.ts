import { apiRequest } from "../api";
import type { ChatMessage } from "../chat/client";

// The user's saved documents (backend/app/documents_api.py). A saved document is the whole
// draft: its type, its form as the chat API takes it, and the conversation.

export type DraftSnapshot = { documentType: string; form: Record<string, unknown>; messages: ChatMessage[] };
export type SavedSummary = { id: number; documentType: string; title: string; createdAt: string; updatedAt: string };
export type SavedDocument = SavedSummary & DraftSnapshot;

/** Where a saved document opens in the editor; the site is static, so the id is a query parameter. */
export const editorHref = (id: number) => `/editor/?id=${id}`;

export const listSaved = (fetchImpl?: typeof fetch) => apiRequest<SavedSummary[]>("/api/documents", { fetchImpl });

export const getSaved = (id: number, fetchImpl?: typeof fetch) => apiRequest<SavedDocument>(`/api/documents/${id}`, { fetchImpl });

export const createSaved = (snapshot: DraftSnapshot, fetchImpl?: typeof fetch) =>
  apiRequest<SavedDocument>("/api/documents", { method: "POST", body: snapshot, fetchImpl });

export const updateSaved = (id: number, snapshot: DraftSnapshot, fetchImpl?: typeof fetch) =>
  apiRequest<SavedDocument>(`/api/documents/${id}`, { method: "PUT", body: snapshot, fetchImpl });

export const deleteSaved = (id: number, fetchImpl?: typeof fetch) => apiRequest<void>(`/api/documents/${id}`, { method: "DELETE", fetchImpl });
