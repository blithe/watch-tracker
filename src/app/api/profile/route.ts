import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUserIdFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const userId = getSessionUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    let profile = await db.prepare(
      'SELECT * FROM user_profiles WHERE user_id = ?'
    ).get(userId);

    if (!profile) {
      // Auto-create profile from email prefix
      const user = await db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as any;
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

      let emailPrefix = user.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
      // Ensure username is at least 3 chars
      if (emailPrefix.length < 3) emailPrefix = emailPrefix + '_user';
      // Ensure unique username by appending id if needed
      let username = emailPrefix;
      const existing = await db.prepare('SELECT user_id FROM user_profiles WHERE username = ?').get(username);
      if (existing) {
        username = `${emailPrefix}_${userId}`;
      }

      await db.prepare(
        `INSERT INTO user_profiles (user_id, display_name, username) VALUES (?, ?, ?)`
      ).run(userId, emailPrefix, username);

      profile = await db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(userId);
    }

    return NextResponse.json(profile);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const userId = getSessionUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { display_name, username, bio, is_discoverable } = await req.json();

  if (!display_name || !username) {
    return NextResponse.json({ error: 'Display name and username are required' }, { status: 400 });
  }

  // Validate username format
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
    return NextResponse.json({ error: 'Username must be 3-30 characters (letters, numbers, underscores)' }, { status: 400 });
  }

  try {
    // Check username uniqueness (excluding own profile)
    const existing = await db.prepare(
      'SELECT user_id FROM user_profiles WHERE username = ? AND user_id != ?'
    ).get(username, userId);
    if (existing) {
      return NextResponse.json({ error: 'Username is already taken' }, { status: 409 });
    }

    // Ensure profile exists (auto-create if not)
    const profile = await db.prepare('SELECT user_id FROM user_profiles WHERE user_id = ?').get(userId);
    if (!profile) {
      await db.prepare(
        `INSERT INTO user_profiles (user_id, display_name, username, bio, is_discoverable) VALUES (?, ?, ?, ?, ?)`
      ).run(userId, display_name, username, bio || null, is_discoverable ? 1 : 0);
    } else {
      await db.prepare(
        `UPDATE user_profiles SET display_name = ?, username = ?, bio = ?, is_discoverable = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`
      ).run(display_name, username, bio || null, is_discoverable ? 1 : 0, userId);
    }

    const updated = await db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(userId);
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
