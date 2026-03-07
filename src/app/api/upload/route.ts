import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { writeFile } from 'fs/promises';
import { join } from 'path';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File;
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

  const nameParts = file.name.split('.');
  const ext = nameParts.length > 1 ? nameParts.pop() : 'jpg';
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(filename, file, { access: 'public' });
    return NextResponse.json({ url: blob.url });
  } else {
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(join(process.cwd(), 'public', 'uploads', filename), buffer);
    return NextResponse.json({ url: `/uploads/${filename}` });
  }
}
