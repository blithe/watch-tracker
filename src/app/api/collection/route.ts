import { NextResponse } from 'next/server';
import db, { CollectionWatch } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Get all watches with wear counts
  const watches = await db.prepare(`
    SELECT w.*,
           COUNT(wl.id) as wear_count
    FROM watches w
    LEFT JOIN wear_log wl ON w.id = wl.watch_id
    GROUP BY w.id
    ORDER BY w.brand, w.model
  `).all() as CollectionWatch[];

  // Add computed fields for sold watches
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

  // Split by status
  const owned = watchesWithComputed.filter(w => w.status === 'owned' || w.status !== 'sold');
  const sold = watchesWithComputed.filter(w => w.status === 'sold');

  // Calculate summary stats
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
