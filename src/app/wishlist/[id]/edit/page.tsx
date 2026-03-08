'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface WishlistItem {
  id: number;
  brand: string;
  model: string;
  reference: string | null;
  image_url: string | null;
  source_url: string | null;
  target_price: number | null;
  notes: string | null;
  status: string;
}

export default function EditWishlistPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [item, setItem] = useState<WishlistItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    brand: '',
    model: '',
    reference: '',
    source_url: '',
    target_price: '',
    notes: '',
    status: 'watching',
  });

  useEffect(() => {
    if (id) fetchItem();
  }, [id]);

  useEffect(() => {
    if (item) {
      setFormData({
        brand: item.brand,
        model: item.model,
        reference: item.reference || '',
        source_url: item.source_url || '',
        target_price: item.target_price?.toString() || '',
        notes: item.notes || '',
        status: item.status,
      });
    }
  }, [item]);

  async function fetchItem() {
    try {
      const res = await fetch('/api/wishlist');
      if (!res.ok) throw new Error('Failed to fetch wishlist');
      const items = await res.json();
      const found = items.find((i: WishlistItem) => i.id === Number(id));
      if (!found) throw new Error('Wishlist item not found');
      setItem(found);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setPhoto(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      let image_url: string | null | undefined = undefined;
      if (photo) {
        const fd = new FormData();
        fd.append('file', photo);
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd });
        if (!uploadRes.ok) throw new Error('Failed to upload photo');
        const { url } = await uploadRes.json();
        image_url = url;
      }

      const res = await fetch('/api/wishlist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: Number(id),
          brand: formData.brand,
          model: formData.model,
          reference: formData.reference || null,
          ...(image_url !== undefined ? { image_url } : { image_url: item?.image_url ?? null }),
          source_url: formData.source_url || null,
          target_price: formData.target_price ? parseFloat(formData.target_price) : null,
          notes: formData.notes || null,
          status: formData.status,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update');
      }

      router.push(`/wishlist/${id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500";
  const currentImage = photoPreview || item?.image_url;

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="text-zinc-400">Loading...</div></div>;
  }

  if (!item) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
        <p className="text-red-400">{error || 'Wishlist item not found'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/wishlist/${id}`} className="text-zinc-400 hover:text-zinc-200 transition-colors">
          ← Back
        </Link>
      </div>

      <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-6">
        <h1 className="text-2xl font-bold mb-6">Edit Wishlist Item</h1>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Brand *</label>
              <input type="text" name="brand" value={formData.brand} onChange={handleChange} required className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Model *</label>
              <input type="text" name="model" value={formData.model} onChange={handleChange} required className={inputCls} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Reference</label>
            <input type="text" name="reference" value={formData.reference} onChange={handleChange} className={inputCls} />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Photo</label>
            {currentImage && (
              <img src={currentImage} alt="Watch" className="mb-2 h-32 rounded-lg object-cover" />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-zinc-100 file:mr-3 file:rounded file:border-0 file:bg-zinc-600 file:text-zinc-100 file:px-3 file:py-1 file:text-sm"
            />
            {item.image_url && <p className="text-xs text-zinc-400 mt-1">Upload a new photo to replace the current one</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Source URL</label>
            <input type="url" name="source_url" value={formData.source_url} onChange={handleChange} className={inputCls} placeholder="https://..." />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Target Price ($)</label>
            <input type="number" name="target_price" value={formData.target_price} onChange={handleChange} step="0.01" min="0" className={inputCls} placeholder="0.00" />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Status</label>
            <select name="status" value={formData.status} onChange={handleChange} className={inputCls}>
              <option value="watching">Watching</option>
              <option value="purchased">Purchased</option>
              <option value="removed">Not Interested</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Notes</label>
            <textarea name="notes" value={formData.notes} onChange={handleChange} rows={4} className={inputCls} />
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <Link href={`/wishlist/${id}`} className="px-4 py-2 bg-zinc-600 hover:bg-zinc-500 rounded-lg font-medium transition-colors text-center">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
