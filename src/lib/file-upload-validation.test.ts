import { describe, expect, it } from 'vitest';
import { FileValidationError, validatePdfUpload } from '@/lib/file-upload-validation';

function pdfFile(content: string, name = 'test.pdf') {
  const bytes = new TextEncoder().encode(content);
  return new File([bytes], name, { type: 'application/pdf' });
}

describe('file-upload-validation', () => {
  it('accepts valid PDF magic bytes', async () => {
    const result = await validatePdfUpload(pdfFile('%PDF-1.4 fake content'), { maxBytes: 1024 });
    expect(result.mimeType).toBe('application/pdf');
    expect(result.buffer.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('rejects non-PDF content', async () => {
    await expect(
      validatePdfUpload(pdfFile('not a pdf'), { maxBytes: 1024 }),
    ).rejects.toBeInstanceOf(FileValidationError);
  });
});
