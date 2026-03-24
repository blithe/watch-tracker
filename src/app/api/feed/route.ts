import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUserIdFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const userId = getSessionUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get('cursor');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

  try {
    let query = `
      SELECT wl.id, wl.date, wl.image_url, wl.notes, wl.created_at,
             w.brand, w.model, w.reference
      FROM wear_log wl
      JOIN watches w ON w.id = wl.watch_id
      WHERE wl.image_url IS NOT NULL
        AND wl.user_id = ?
    `;

    const params: any[] = [userId];

    if (cursor) {
      query += ` AND wl.id < ?`;
      params.push(parseInt(cursor));
    }

    query += ` ORDER BY wl.id DESC LIMIT ?`;
    params.push(limit);

    const items = await db.prepare(query).all(...params);

    return NextResponse.json({
      items,
      nextCursor: items.length === limit ? items[items.length - 1].id : null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
