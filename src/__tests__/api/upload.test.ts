/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/upload/route';
import { writeFile } from 'fs/promises';

// Mock fs/promises
jest.mock('fs/promises');
const mockWriteFile = writeFile as jest.MockedFunction<typeof writeFile>;

describe('/api/upload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWriteFile.mockResolvedValue();
  });

  describe('POST /api/upload', () => {
    it('should upload a file successfully', async () => {
      // Create a mock file
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
      expect(data.url).toMatch(/^\/uploads\/.+\.jpg$/);

      // Verify writeFile was called
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      const [filepath, buffer] = mockWriteFile.mock.calls[0];
      
      expect(filepath).toMatch(/public\/uploads\/.+\.jpg$/);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.toString()).toBe(fileContent);
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
      expect(data.url).toMatch(/^\/uploads\/.+\.png$/);

      // Verify filepath includes correct extension
      const [filepath] = mockWriteFile.mock.calls[0];
      expect(filepath).toMatch(/\.png$/);
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
      expect(data.url).toMatch(/^\/uploads\/.+\.jpg$/);

      // Verify filepath defaults to jpg
      const [filepath] = mockWriteFile.mock.calls[0];
      expect(filepath).toMatch(/\.jpg$/);
    });

    it('should return 400 when no file is provided', async () => {
      const formData = new FormData();
      // Don't append any file

      const request = new NextRequest('http://localhost/api/upload', {
        method: 'POST',
        body: formData
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: 'No file' });
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('should generate unique filenames', async () => {
      const file1 = new File(['content1'], 'test.jpg', { type: 'image/jpeg' });
      const file2 = new File(['content2'], 'test.jpg', { type: 'image/jpeg' });
      
      // Upload first file
      const formData1 = new FormData();
      formData1.append('file', file1);
      const request1 = new NextRequest('http://localhost/api/upload', {
        method: 'POST',
        body: formData1
      });
      
      // Upload second file
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
      
      // Both should have same extension but different names
      expect(data1.url).toMatch(/^\/uploads\/.+\.jpg$/);
      expect(data2.url).toMatch(/^\/uploads\/.+\.jpg$/);

      // Verify both writeFile calls had different paths
      expect(mockWriteFile).toHaveBeenCalledTimes(2);
      const [filepath1] = mockWriteFile.mock.calls[0];
      const [filepath2] = mockWriteFile.mock.calls[1];
      expect(filepath1).not.toBe(filepath2);
    });

    it('should handle various file extensions correctly', async () => {
      const testCases = [
        { filename: 'test.jpeg', expected: '.jpeg' },
        { filename: 'test.gif', expected: '.gif' },
        { filename: 'test.webp', expected: '.webp' },
        { filename: 'test.bmp', expected: '.bmp' },
        { filename: 'test.PNG', expected: '.PNG' }, // Case sensitive
      ];

      for (const testCase of testCases) {
        mockWriteFile.mockClear();
        
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
        expect(data.url).toContain(`uploads/`);
        expect(data.url.endsWith(testCase.expected)).toBe(true);

        const [filepath] = mockWriteFile.mock.calls[0];
        expect(filepath.endsWith(testCase.expected)).toBe(true);
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
      const data = await response.json();

      const afterTime = Date.now();

      expect(response.status).toBe(200);
      
      // Extract the filename from the URL
      const filename = data.url.split('/').pop();
      const [timestampPart, randomPart] = filename.split('-');
      
      // Verify timestamp is within expected range
      const timestamp = parseInt(timestampPart);
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp).toBeLessThanOrEqual(afterTime);
      
      // Verify random part exists and has expected format (6 chars + .jpg)
      expect(randomPart).toMatch(/^[a-z0-9]{6}\.jpg$/);
    });
  });
});