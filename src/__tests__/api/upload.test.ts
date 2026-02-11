/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/upload/route';

// Mock @vercel/blob
jest.mock('@vercel/blob', () => ({
  put: jest.fn(),
}));

import { put } from '@vercel/blob';
const mockPut = put as jest.MockedFunction<typeof put>;

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

  describe('POST /api/upload', () => {
    it('should upload a file successfully', async () => {
      const fileContent = 'fake image content';
      const file = new File([fileContent], 'test.jpg', { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('file', file);

      const request = new NextRequest('http://localhost/api/upload', {
        method: 'POST',
        body: formData
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('url');
      expect(data.url).toContain('blob.vercel-storage.com');
      expect(data.url).toMatch(/\.jpg$/);

      expect(mockPut).toHaveBeenCalledTimes(1);
      const [filename, blob, options] = mockPut.mock.calls[0];
      expect(filename).toMatch(/\.jpg$/);
      expect(options).toEqual({ access: 'public' });
    });

    it('should handle different file extensions', async () => {
      const file = new File(['png content'], 'test.png', { type: 'image/png' });

      const formData = new FormData();
      formData.append('file', file);

      const request = new NextRequest('http://localhost/api/upload', {
        method: 'POST',
        body: formData
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.url).toMatch(/\.png$/);

      const [filename] = mockPut.mock.calls[0];
      expect(filename).toMatch(/\.png$/);
    });

    it('should default to jpg for files without extension', async () => {
      const file = new File(['no extension content'], 'noextension', { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('file', file);

      const request = new NextRequest('http://localhost/api/upload', {
        method: 'POST',
        body: formData
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.url).toMatch(/\.jpg$/);

      const [filename] = mockPut.mock.calls[0];
      expect(filename).toMatch(/\.jpg$/);
    });

    it('should return 400 when no file is provided', async () => {
      const formData = new FormData();

      const request = new NextRequest('http://localhost/api/upload', {
        method: 'POST',
        body: formData
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: 'No file' });
      expect(mockPut).not.toHaveBeenCalled();
    });

    it('should generate unique filenames', async () => {
      const file1 = new File(['content1'], 'test.jpg', { type: 'image/jpeg' });
      const file2 = new File(['content2'], 'test.jpg', { type: 'image/jpeg' });

      const formData1 = new FormData();
      formData1.append('file', file1);
      const request1 = new NextRequest('http://localhost/api/upload', {
        method: 'POST',
        body: formData1
      });

      const formData2 = new FormData();
      formData2.append('file', file2);
      const request2 = new NextRequest('http://localhost/api/upload', {
        method: 'POST',
        body: formData2
      });

      const response1 = await POST(request1);
      const response2 = await POST(request2);

      const data1 = await response1.json();
      const data2 = await response2.json();

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);

      // URLs should be different (unique filenames)
      expect(data1.url).not.toBe(data2.url);

      expect(data1.url).toMatch(/\.jpg$/);
      expect(data2.url).toMatch(/\.jpg$/);

      expect(mockPut).toHaveBeenCalledTimes(2);
      const [filename1] = mockPut.mock.calls[0];
      const [filename2] = mockPut.mock.calls[1];
      expect(filename1).not.toBe(filename2);
    });

    it('should handle various file extensions correctly', async () => {
      const testCases = [
        { filename: 'test.jpeg', expected: '.jpeg' },
        { filename: 'test.gif', expected: '.gif' },
        { filename: 'test.webp', expected: '.webp' },
        { filename: 'test.bmp', expected: '.bmp' },
        { filename: 'test.PNG', expected: '.PNG' },
      ];

      for (const testCase of testCases) {
        mockPut.mockClear();

        const file = new File(['content'], testCase.filename, { type: 'image/jpeg' });
        const formData = new FormData();
        formData.append('file', file);

        const request = new NextRequest('http://localhost/api/upload', {
          method: 'POST',
          body: formData
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.url.endsWith(testCase.expected)).toBe(true);

        const [filename] = mockPut.mock.calls[0];
        expect(filename.endsWith(testCase.expected)).toBe(true);
      }
    });

    it('should generate filename with timestamp and random component', async () => {
      const beforeTime = Date.now();

      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('file', file);

      const request = new NextRequest('http://localhost/api/upload', {
        method: 'POST',
        body: formData
      });

      const response = await POST(request);
      await response.json();

      const afterTime = Date.now();

      expect(response.status).toBe(200);

      const [filename] = mockPut.mock.calls[0];
      const [timestampPart, randomPart] = filename.split('-');

      const timestamp = parseInt(timestampPart);
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp).toBeLessThanOrEqual(afterTime);

      expect(randomPart).toMatch(/^[a-z0-9]{6}\.jpg$/);
    });
  });
});
