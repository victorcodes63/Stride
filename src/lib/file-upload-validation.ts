const PDF_MAGIC = Buffer.from('%PDF');

export class FileValidationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'FileValidationError';
    this.status = status;
  }
}

export type ValidatedUpload = {
  buffer: Buffer;
  mimeType: string;
  size: number;
  fileName: string;
};

export async function validatePdfUpload(
  file: File,
  options: { maxBytes: number; fieldLabel?: string },
): Promise<ValidatedUpload> {
  const label = options.fieldLabel ?? 'File';
  if (!file || typeof file === 'string') {
    throw new FileValidationError(`${label} is required.`);
  }
  if (file.size <= 0) {
    throw new FileValidationError(`${label} is empty.`);
  }
  if (file.size > options.maxBytes) {
    throw new FileValidationError(
      `${label} too large (max ${Math.round(options.maxBytes / 1024 / 1024)}MB).`,
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length < 4 || !buffer.subarray(0, 4).equals(PDF_MAGIC)) {
    throw new FileValidationError('Only valid PDF files are accepted.');
  }

  const declared = file.type?.trim().toLowerCase();
  const mimeType =
    declared === 'application/pdf' || declared === 'application/x-pdf'
      ? 'application/pdf'
      : 'application/pdf';

  return {
    buffer,
    mimeType,
    size: file.size,
    fileName: file.name || 'upload.pdf',
  };
}
