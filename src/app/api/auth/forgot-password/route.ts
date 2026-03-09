import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import crypto from 'crypto';
import { Resend } from 'resend';

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail) as any;

  // Always return success to prevent email enumeration
  if (!user) {
    return NextResponse.json({ ok: true });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

  await db.prepare(
    'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?'
  ).run(token, expires, user.id);

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const resend = new Resend(resendKey);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://watch-tracker-mauve.vercel.app';
    await resend.emails.send({
      from: 'Watch Tracker <noreply@watch-tracker-mauve.vercel.app>',
      to: normalizedEmail,
      subject: 'Reset your Watch Tracker password',
      html: `
        <p>You requested a password reset for your Watch Tracker account.</p>
        <p><a href="${baseUrl}/reset-password?token=${token}">Click here to reset your password</a></p>
        <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
      `,
    });
  }

  return NextResponse.json({ ok: true });
}
