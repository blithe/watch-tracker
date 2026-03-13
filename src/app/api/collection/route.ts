import { NextRequest, NextResponse } from 'next/server';
import db, { CollectionWatch } from '@/lib/db';
import { getSessionUserIdFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest) {
  const userId = getSessionUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { confirm } = await req.json();
  if (confirm !== 'DELETE_ALL') {
    return NextResponse.json({ error: 'Confirmation required' }, { status: 400 });
  }

  // Delete wear logs first (foreign key on watch_id), then watches
  await db.prepare('DELETE FROM wear_log WHERE user_id = ?').run(userId);
  await db.prepare('DELETE FROM watches WHERE user_id = ?').run(userId);

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const userId = getSessionUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const watches = await db.prepare(`
    SELECT w.*,
           COUNT(wl.id) as wear_count,
           COALESCE(w.image_url, (
             SELECT wl2.image_url
             FROM wear_log wl2
             WHERE wl2.watch_id = w.id AND wl2.image_url IS NOT NULL
             ORDER BY wl2.date ASC
             LIMIT 1
           )) as image_url
    FROM watches w
    LEFT JOIN wear_log wl ON w.id = wl.watch_id
    WHERE w.user_id = ?
    GROUP BY w.id
    ORDER BY w.brand, w.model
  `).all(userId) as CollectionWatch[];

  const watchesWithComputed = watches.map(watch => {
    if (watch.sold_date && watch.purchase_date) {
      const purchaseDate = new Date(watch.purchase_date);
      const soldDate = new Date(watch.sold_date);
      const timeDiff = soldDate.getTime() - purchaseDate.getTime();
      const days_owned = Math.ceil(timeDiff / (1000 * 3600 * 24));

      let profit_loss = null;
      if (watch.purchase_price && watch.sold_price) {
        profit_loss = watch.sold_price - watch.purchase_price;
      }

      return { ...watch, days_owned, profit_loss };
    }
    return watch;
  });

  const owned = watchesWithComputed.filter(w => w.status === 'owned' || w.status !== 'sold');
  const sold = watchesWithComputed.filter(w => w.status === 'sold');

  const totalCollectionValue = owned.reduce((sum, w) => sum + (w.purchase_price || 0), 0);
  const totalInvested = watches.reduce((sum, w) => sum + (w.purchase_price || 0), 0);
  const totalSoldFor = sold.reduce((sum, w) => sum + (w.sold_price || 0), 0);
  const overallProfitLoss = sold.reduce((sum, w) => sum + (w.profit_loss || 0), 0);

  return NextResponse.json({
    owned,
    sold,
    stats: {
      totalCollectionValue,
      totalInvested,
      totalSoldFor,
      overallProfitLoss,
      totalWatches: watches.length,
      ownedCount: owned.length,
      soldCount: sold.length
    }
  });
}
