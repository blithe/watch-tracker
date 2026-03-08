/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/upload/route';

// Mock @vercel/blob
jest.mock('@vercel/blob', () => ({
  put: jest.fn(),
}));

// Mock fs/promises
jest.mock('fs/promises', () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

import { put } from '@vercel/blob';
import { writeFile } from 'fs/promises';
const mockPut = put as jest.MockedFunction<typeof put>;
const mockWriteFile = writeFile as jest.MockedFunction<typeof writeFile>;

describe('/api/upload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPut.mockImplementation(async (filename: string) => ({
      url: `https://blob.vercel-storage.com/${filename}`,
      downloadUrl: `https://blob.vercel-storage.com/${filename}`,
      pathname: filename,
      contentType: 'image/jpeg',
      contentDisposition: `attachment; filename="${filename}"`,
    }) as any);
  });

  describe('Vercel Blob mode (BLOB_READ_WRITE_TOKEN set)', () => {
    beforeEach(() => { process.env.BLOB_READ_WRITE_TOKEN = 'test-token'; });
    afterEach(() => { delete process.env.BLOB_READ_WRITE_TOKEN; });

    it('should upload via blob and return blob URL', async () => {
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('file', file);

      const response = await POST(new NextRequest('http://localhost/api/upload', { method: 'POST', body: formData }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.url).toContain('blob.vercel-storage.com');
      expect(data.url).toMatch(/\.jpg$/);
      expect(mockPut).toHaveBeenCalledTimes(1);
      expect(mockWriteFile).not.toHaveBeenCalled();

      const [filename, , options] = mockPut.mock.calls[0];
      expect(filename).toMatch(/\.jpg$/);
      expect(options).toEqual({ access: 'public' });
    });

    it('should handle different file extensions', async () => {
      const file = new File(['content'], 'test.png', { type: 'image/png' });
      const formData = new FormData();
      formData.append('file', file);

      const response = await POST(new NextRequest('http://localhost/api/upload', { method: 'POST', body: formData }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.url).toMatch(/\.png$/);
    });

    it('should generate unique filenames', async () => {
      const makeRequest = () => {
        const formData = new FormData();
        formData.append('file', new File(['content'], 'test.jpg', { type: 'image/jpeg' }));
        return POST(new NextRequest('http://localhost/api/upload', { method: 'POST', body: formData }));
      };

      const [r1, r2] = await Promise.all([makeRequest(), makeRequest()]);
      const [d1, d2] = await Promise.all([r1.json(), r2.json()]);
      expect(d1.url).not.toBe(d2.url);
    });
  });

  describe('Local storage mode (no BLOB_READ_WRITE_TOKEN)', () => {
    beforeEach(() => { delete process.env.BLOB_READ_WRITE_TOKEN; });

    it('should write to local disk and return /uploads/ URL', async () => {
      const fileContent = 'fake image content';
      const file = new File([fileContent], 'test.jpg', { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('file', file);

      const response = await POST(new NextRequest('http://localhost/api/upload', { method: 'POST', body: formData }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.url).toMatch(/^\/uploads\/\d+-[a-f0-9]{12}\.jpg$/);
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      expect(mockPut).not.toHaveBeenCalled();

      const [filepath, buffer] = mockWriteFile.mock.calls[0];
      expect(filepath).toMatch(/public\/uploads\/\d+-[a-f0-9]{12}\.jpg$/);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.toString()).toBe(fileContent);
    });

    it('should handle different file extensions locally', async () => {
      for (const ext of ['png', 'webp', 'gif']) {
        mockWriteFile.mockClear();
        const file = new File(['content'], `test.${ext}`, { type: `image/${ext}` });
        const formData = new FormData();
        formData.append('file', file);

        const response = await POST(new NextRequest('http://localhost/api/upload', { method: 'POST', body: formData }));
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.url).toMatch(new RegExp(`\\.${ext}$`));
      }
    });
  });

  describe('security validation', () => {
    it('should reject files larger than 10MB', async () => {
      process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
      const largeContent = 'x'.repeat(11 * 1024 * 1024);
      const file = new File([largeContent], 'big.jpg', { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('file', file);

      const response = await POST(new NextRequest('http://localhost/api/upload', { method: 'POST', body: formData }));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toMatch(/too large/i);
      delete process.env.BLOB_READ_WRITE_TOKEN;
    });

    it('should reject non-image file types', async () => {
      process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
      const file = new File(['<script>alert(1)</script>'], 'evil.html', { type: 'text/html' });
      const formData = new FormData();
      formData.append('file', file);

      const response = await POST(new NextRequest('http://localhost/api/upload', { method: 'POST', body: formData }));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toMatch(/only image/i);
      delete process.env.BLOB_READ_WRITE_TOKEN;
    });

    it('should accept valid image types', async () => {
      process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
      for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/heic']) {
        const file = new File(['content'], 'photo.jpg', { type });
        const formData = new FormData();
        formData.append('file', file);

        const response = await POST(new NextRequest('http://localhost/api/upload', { method: 'POST', body: formData }));
        expect(response.status).toBe(200);
      }
      delete process.env.BLOB_READ_WRITE_TOKEN;
    });
  });

  describe('shared behavior', () => {
    it('should return 400 when no file is provided', async () => {
      const response = await POST(new NextRequest('http://localhost/api/upload', {
        method: 'POST',
        body: new FormData()
      }));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: 'No file' });
      expect(mockPut).not.toHaveBeenCalled();
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('should default to jpg for files without extension', async () => {
      process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
      const file = new File(['content'], 'noextension', { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('file', file);

      const response = await POST(new NextRequest('http://localhost/api/upload', { method: 'POST', body: formData }));
      const data = await response.json();

      expect(data.url).toMatch(/\.jpg$/);
      delete process.env.BLOB_READ_WRITE_TOKEN;
    });
  });
});
