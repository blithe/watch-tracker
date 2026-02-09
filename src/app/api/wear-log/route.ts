import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { watch_id, date, image_url, notes } = await req.json();
  try {
    db.prepare('INSERT INTO wear_log (watch_id, date, image_url, notes) VALUES (?, ?, ?, ?)').run(
      watch_id, date, image_url || null, notes || null
    );
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) {
      return NextResponse.json({ error: 'Already logged a watch for this date' }, { status: 400 });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
