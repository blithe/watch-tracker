import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { writeFile } from 'fs/promises';
import { join } from 'path';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
    }

    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif'];
    if (!ALLOWED_TYPES.includes(file.type.toLowerCase())) {
      return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 });
    }

    const nameParts = file.name.split('.');
    const ext = (nameParts.length > 1 ? nameParts.pop() : 'jpg')!.toLowerCase();
    const randomPart = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    const filename = `${Date.now()}-${randomPart}.${ext}`;

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(filename, file, { access: 'public' });
      return NextResponse.json({ url: blob.url });
    } else {
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(join(process.cwd(), 'public', 'uploads', filename), buffer);
      return NextResponse.json({ url: `/uploads/${filename}` });
    }
  } catch (err: any) {
    console.error('Upload error:', err);
    return NextResponse.json({ error: err.message || 'Upload failed' }, { status: 500 });
  }
}
