export type { ActionResult } from "@/types/actions";
export type { DocumentKind } from "./lib/files";

/** A stored file as shown in the library (READY uploads only). */
export interface DocumentDto {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

/** Returned by createUploadAction — where the browser sends the bytes. */
export interface UploadTicket {
  documentId: string;
  uploadUrl: string;
}
