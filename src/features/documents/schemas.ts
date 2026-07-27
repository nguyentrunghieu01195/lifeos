import { z } from "zod";

import { ACCEPTED_MIME_TYPES, MAX_FILE_SIZE } from "./lib/files";

export const createUploadSchema = z.object({
  name: z.string().trim().min(1, "File name is required.").max(200),
  mimeType: z.enum(ACCEPTED_MIME_TYPES, {
    message: "This file type isn't supported.",
  }),
  size: z
    .number()
    .int()
    .positive("Empty files can't be uploaded.")
    .max(MAX_FILE_SIZE, "Files are limited to 25 MB."),
});

export const renameDocumentSchema = z.object({
  id: z.string().cuid(),
  name: z.string().trim().min(1, "Name is required.").max(200),
});

export type CreateUploadInput = z.infer<typeof createUploadSchema>;
