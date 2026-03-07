/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST as uploadImage } from '@/app/api/upload/route';
import { POST as createWatch } from '@/app/api/watches/route';
import { PATCH as updateWatch } from '@/app/api/watches/[id]/route';
import { POST as logWear } from '@/app/api/wear-log/route';
import { getTestDb, resetTestDb, closeTestDb } from '@/lib/test-db';
import { put } from '@vercel/blob';

// Mock the main db module to use test database
jest.mock('../../lib/db', () => {
  return require('../../lib/test-db').getTestDb();
});

// Mock @vercel/blob for upload tests
jest.mock('@vercel/blob', () => ({
  put: jest.fn(),
}));

const mockPut = put as jest.MockedFunction<typeof put>;

describe('Integration: Image Upload Flow', () => {
  beforeEach(() => {
    resetTestDb();
    mockPut.mockClear();
    mockPut.mockImplementation(async (filename: string) => ({
      url: `https://blob.vercel-storage.com/${filename}`,
      downloadUrl: `https://blob.vercel-storage.com/${filename}`,
      pathname: filename,
      contentType: 'image/jpeg',
      contentDisposition: `attachment; filename="${filename}"`,
    }) as any);
  });

  afterAll(() => {
    closeTestDb();
  });

  it('should complete the full image upload and wear logging flow', async () => {
    const db = getTestDb();

    // Step 1: Upload an image via POST /api/upload
    
    // Create a mock file
    const mockFileContent = 'fake-image-content';
    const mockFile = new File([mockFileContent], 'test-watch.jpg', { type: 'image/jpeg' });
    
    // Create FormData
    const formData = new FormData();
    formData.append('file', mockFile);

    const uploadRequest = new NextRequest('http://localhost/api/upload', {
      method: 'POST',
      body: formData
    });

    const uploadResponse = await uploadImage(uploadRequest);
    expect(uploadResponse.status).toBe(200);

    const uploadResult = await uploadResponse.json();
    
    // Step 2: Verify returned URL is valid
    expect(uploadResult).toHaveProperty('url');
    expect(uploadResult.url).toMatch(/^https:\/\/blob\.vercel-storage\.com\/\d+-[a-z0-9]{6}\.jpg$/);

    // Verify blob put was called with correct args
    expect(mockPut).toHaveBeenCalledTimes(1);
    const [filename, , options] = mockPut.mock.calls[0];
    expect(filename).toMatch(/^\d+-[a-z0-9]{6}\.jpg$/);
    expect(options).toEqual({ access: 'public' });

    // Step 3: Create a watch first
    const watchData = {
      brand: 'Omega',
      model: 'Speedmaster',
      reference: '311.30.42.30.01.005'
    };

    const createWatchRequest = new NextRequest('http://localhost/api/watches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(watchData)
    });

    const createWatchResponse = await createWatch(createWatchRequest);
    const createdWatch = await createWatchResponse.json();

    // Step 4: Use that URL when logging a wear entry
    const wearData = {
      watch_id: createdWatch.id,
      date: '2026-02-20',
      image_url: uploadResult.url,
      notes: 'Great photo of the Speedmaster'
    };

    const logWearRequest = new NextRequest('http://localhost/api/wear-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(wearData)
    });

    const logWearResponse = await logWear(logWearRequest);
    expect(logWearResponse.status).toBe(200);

    // Step 5: Verify the day detail query returns the image URL
    const dayLog = db.prepare(`
      SELECT wl.*, w.brand, w.model, w.reference, w.image_url as watch_image
      FROM wear_log wl
      JOIN watches w ON w.id = wl.watch_id
      WHERE wl.date = ?
    `).get('2026-02-20');

    expect(dayLog).toMatchObject({
      date: '2026-02-20',
      image_url: uploadResult.url,
      notes: 'Great photo of the Speedmaster',
      brand: 'Omega',
      model: 'Speedmaster',
      reference: '311.30.42.30.01.005'
    });

    // Step 6: Verify it appears correctly in the calendar month query
    const calendarLogs = db.prepare(`
      SELECT w.*, wl.id as wl_id, wl.date, wl.image_url as log_image, wl.notes
      FROM wear_log wl
      JOIN watches w ON w.id = wl.watch_id
      WHERE wl.date LIKE ?
      ORDER BY wl.date
    `).all('2026-02-%');

    expect(calendarLogs).toHaveLength(1);
    expect(calendarLogs[0]).toMatchObject({
      log_image: uploadResult.url,
      date: '2026-02-20',
      brand: 'Omega',
      model: 'Speedmaster'
    });
  });

  it('should handle different image file extensions', async () => {
    const testCases = [
      { filename: 'test.png', type: 'image/png', expectedExt: 'png' },
      { filename: 'test.gif', type: 'image/gif', expectedExt: 'gif' },
      { filename: 'test.webp', type: 'image/webp', expectedExt: 'webp' },
      { filename: 'test', type: 'image/jpeg', expectedExt: 'jpg' }, // No extension defaults to jpg
      { filename: 'test.JPEG', type: 'image/jpeg', expectedExt: 'JPEG' } // Preserve case
    ];

    for (const { filename, type, expectedExt } of testCases) {
      mockPut.mockClear();

      const mockFile = new File(['content'], filename, { type });
      const formData = new FormData();
      formData.append('file', mockFile);

      const uploadRequest = new NextRequest('http://localhost/api/upload', {
        method: 'POST',
        body: formData
      });

      const uploadResponse = await uploadImage(uploadRequest);
      expect(uploadResponse.status).toBe(200);

      const uploadResult = await uploadResponse.json();
      expect(uploadResult.url).toMatch(new RegExp(`^https://blob\\.vercel-storage\\.com/\\d+-[a-z0-9]{6}\\.${expectedExt}$`));

      // Verify blob was called with correct extension
      const [blobFilename] = mockPut.mock.calls[0];
      expect(blobFilename).toMatch(new RegExp(`\\.${expectedExt}$`));
    }
  });

  it('should return 400 for missing file', async () => {
    // Create FormData without file
    const formData = new FormData();

    const uploadRequest = new NextRequest('http://localhost/api/upload', {
      method: 'POST',
      body: formData
    });

    const uploadResponse = await uploadImage(uploadRequest);
    expect(uploadResponse.status).toBe(400);

    const errorResult = await uploadResponse.json();
    expect(errorResult).toEqual({ error: 'No file' });

    // Verify blob put was not called
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('should generate unique filenames for multiple uploads', async () => {
    const uploads = [];

    // Upload the same file multiple times
    for (let i = 0; i < 3; i++) {
      mockPut.mockClear();

      const mockFile = new File(['content'], 'same-file.jpg', { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('file', mockFile);

      const uploadRequest = new NextRequest('http://localhost/api/upload', {
        method: 'POST',
        body: formData
      });

      const uploadResponse = await uploadImage(uploadRequest);
      expect(uploadResponse.status).toBe(200);

      const uploadResult = await uploadResponse.json();
      uploads.push(uploadResult.url);

      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // All URLs should be unique
    expect(uploads).toHaveLength(3);
    expect(new Set(uploads).size).toBe(3); // All unique

    // All should match the expected pattern
    uploads.forEach(url => {
      expect(url).toMatch(/^https:\/\/blob\.vercel-storage\.com\/\d+-[a-z0-9]{6}\.jpg$/);
    });
  });

  it('should handle wear logging with both watch image and wear image', async () => {
    const db = getTestDb();

    // Upload a watch image
    const watchImageFile = new File(['watch-image'], 'watch.jpg', { type: 'image/jpeg' });
    const watchImageFormData = new FormData();
    watchImageFormData.append('file', watchImageFile);

    const watchImageRequest = new NextRequest('http://localhost/api/upload', {
      method: 'POST',
      body: watchImageFormData
    });

    const watchImageResponse = await uploadImage(watchImageRequest);
    const watchImageResult = await watchImageResponse.json();

    // Upload a wear-specific image
    mockPut.mockClear();
    const wearImageFile = new File(['wear-image'], 'wear.jpg', { type: 'image/jpeg' });
    const wearImageFormData = new FormData();
    wearImageFormData.append('file', wearImageFile);

    const wearImageRequest = new NextRequest('http://localhost/api/upload', {
      method: 'POST',
      body: wearImageFormData
    });

    const wearImageResponse = await uploadImage(wearImageRequest);
    const wearImageResult = await wearImageResponse.json();

    // Create watch first
    const watchData = {
      brand: 'Rolex',
      model: 'Submariner',
      reference: '116610LN'
    };

    const createWatchRequest = new NextRequest('http://localhost/api/watches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(watchData)
    });

    const createWatchResponse = await createWatch(createWatchRequest);
    const createdWatch = await createWatchResponse.json();

    // Update watch with the watch image using PATCH
    const updateWatchRequest = new NextRequest(`http://localhost/api/watches/${createdWatch.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: watchImageResult.url })
    });

    await updateWatch(updateWatchRequest, { params: { id: createdWatch.id.toString() }});

    // Log wear with the wear-specific image
    const wearData = {
      watch_id: createdWatch.id,
      date: '2026-02-21',
      image_url: wearImageResult.url,
      notes: 'Wear photo on a sunny day'
    };

    const logWearRequest = new NextRequest('http://localhost/api/wear-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(wearData)
    });

    const logWearResponse = await logWear(logWearRequest);
    expect(logWearResponse.status).toBe(200);

    // Verify day detail query returns both images correctly
    const dayLog = db.prepare(`
      SELECT wl.*, w.brand, w.model, w.reference, w.image_url as watch_image
      FROM wear_log wl
      JOIN watches w ON w.id = wl.watch_id
      WHERE wl.date = ?
    `).get('2026-02-21');

    expect(dayLog).toMatchObject({
      date: '2026-02-21',
      image_url: wearImageResult.url, // Wear-specific image
      watch_image: watchImageResult.url, // Watch's default image
      notes: 'Wear photo on a sunny day',
      brand: 'Rolex',
      model: 'Submariner'
    });

    // Verify calendar prioritizes wear image over watch image (log_image vs image_url)
    const calendarLogs = db.prepare(`
      SELECT w.*, wl.id as wl_id, wl.date, wl.image_url as log_image, wl.notes
      FROM wear_log wl
      JOIN watches w ON w.id = wl.watch_id
      WHERE wl.date LIKE ?
      ORDER BY wl.date
    `).all('2026-02-%');

    expect(calendarLogs[0]).toMatchObject({
      log_image: wearImageResult.url, // This is the wear-specific image
      image_url: watchImageResult.url, // This is the watch's default image
      brand: 'Rolex',
      model: 'Submariner'
    });
  });

  it('should handle wear logging without images gracefully', async () => {
    const db = getTestDb();

    // Create watch without image
    const watchData = {
      brand: 'Casio',
      model: 'F-91W'
    };

    const createWatchRequest = new NextRequest('http://localhost/api/watches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(watchData)
    });

    const createWatchResponse = await createWatch(createWatchRequest);
    const createdWatch = await createWatchResponse.json();

    // Log wear without image
    const wearData = {
      watch_id: createdWatch.id,
      date: '2026-02-22',
      notes: 'No photo today'
    };

    const logWearRequest = new NextRequest('http://localhost/api/wear-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(wearData)
    });

    const logWearResponse = await logWear(logWearRequest);
    expect(logWearResponse.status).toBe(200);

    // Verify day detail query handles null images
    const dayLog = db.prepare(`
      SELECT wl.*, w.brand, w.model, w.reference, w.image_url as watch_image
      FROM wear_log wl
      JOIN watches w ON w.id = wl.watch_id
      WHERE wl.date = ?
    `).get('2026-02-22');

    expect(dayLog).toMatchObject({
      date: '2026-02-22',
      image_url: null, // No wear image
      watch_image: null, // No watch image
      notes: 'No photo today',
      brand: 'Casio',
      model: 'F-91W'
    });

    // Verify calendar handles no images
    const calendarLogs = db.prepare(`
      SELECT w.*, wl.id as wl_id, wl.date, wl.image_url as log_image, wl.notes
      FROM wear_log wl
      JOIN watches w ON w.id = wl.watch_id
      WHERE wl.date LIKE ?
      ORDER BY wl.date
    `).all('2026-02-%');

    const noImageLog = calendarLogs.find(log => log.date === '2026-02-22');
    expect(noImageLog).toMatchObject({
      log_image: null,
      image_url: null, // watch image_url
      brand: 'Casio',
      model: 'F-91W'
    });
  });

  it('should maintain image URLs across queries', async () => {
    const db = getTestDb();

    // Upload image
    const mockFile = new File(['test-content'], 'persistent.jpg', { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('file', mockFile);

    const uploadRequest = new NextRequest('http://localhost/api/upload', {
      method: 'POST',
      body: formData
    });

    const uploadResponse = await uploadImage(uploadRequest);
    const uploadResult = await uploadResponse.json();

    // Create watch and log wear with image
    const watchRequest = new NextRequest('http://localhost/api/watches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand: 'Persistent', model: 'Test' })
    });

    const watchResponse = await createWatch(watchRequest);
    const watch = await watchResponse.json();

    const wearRequest = new NextRequest('http://localhost/api/wear-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        watch_id: watch.id,
        date: '2026-02-23',
        image_url: uploadResult.url,
        notes: 'Image persistence test'
      })
    });

    await logWear(wearRequest);

    // Test multiple queries to ensure image URL is consistent
    const queries = [
      // Calendar query
      () => db.prepare(`
        SELECT w.*, wl.id as wl_id, wl.date, wl.image_url as log_image, wl.notes
        FROM wear_log wl
        JOIN watches w ON w.id = wl.watch_id
        WHERE wl.date LIKE ?
        ORDER BY wl.date
      `).all('2026-02-%'),

      // Day detail query  
      () => db.prepare(`
        SELECT wl.*, w.brand, w.model, w.reference, w.image_url as watch_image
        FROM wear_log wl
        JOIN watches w ON w.id = wl.watch_id
        WHERE wl.date = ?
      `).get('2026-02-23'),

      // Direct wear_log query
      () => db.prepare('SELECT * FROM wear_log WHERE date = ?').get('2026-02-23')
    ];

    // All queries should return the same image URL
    for (const query of queries) {
      const result = query();
      
      if (Array.isArray(result)) {
        expect(result[0].log_image).toBe(uploadResult.url);
      } else if (result.image_url !== undefined) {
        expect(result.image_url).toBe(uploadResult.url);
      } else {
        expect(result.image_url).toBe(uploadResult.url);
      }
    }
  });
});