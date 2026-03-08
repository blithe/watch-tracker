'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AddWishlistPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    brand: '',
    model: '',
    reference: '',
    source_url: '',
    target_price: '',
    notes: '',
    status: 'watching',
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setPhoto(file);
    if (file) {
      setPhotoPreview(URL.createObjectURL(file));
    } else {
      setPhotoPreview(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!formData.brand || !formData.model) {
      setError('Brand and model are required');
      setLoading(false);
      return;
    }

    try {
      let image_url: string | null = null;
      if (photo) {
        const uploadForm = new FormData();
        uploadForm.append('file', photo);
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: uploadForm });
        if (!uploadRes.ok) throw new Error('Failed to upload photo');
        const { url } = await uploadRes.json();
        image_url = url;
      }

      const submitData = {
        ...formData,
        image_url,
        target_price: formData.target_price ? Number(formData.target_price) : null,
      };

      const response = await fetch('/api/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add to wishlist');
      }

      router.push('/wishlist');
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  const inputClasses = "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500";

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/wishlist"
          className="text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          ← Back to Wishlist
        </Link>
        <h1 className="text-2xl font-bold">Add to Wishlist</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Brand *</label>
            <input
              type="text"
              name="brand"
              value={formData.brand}
              onChange={handleChange}
              className={inputClasses}
              placeholder="e.g. Rolex, Omega, Grand Seiko"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Model *</label>
            <input
              type="text"
              name="model"
              value={formData.model}
              onChange={handleChange}
              className={inputClasses}
              placeholder="e.g. Submariner, Speedmaster"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-2">Reference</label>
          <input
            type="text"
            name="reference"
            value={formData.reference}
            onChange={handleChange}
            className={inputClasses}
            placeholder="e.g. 116610LN, 311.30.42.30.01.005"
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-2">Photo</label>
          {photoPreview && (
            <img src={photoPreview} alt="Preview" className="w-32 h-32 object-cover rounded-lg mb-2" />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            className="w-full text-sm text-zinc-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-zinc-700 file:text-zinc-200 hover:file:bg-zinc-600"
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-2">Source URL</label>
          <input
            type="url"
            name="source_url"
            value={formData.source_url}
            onChange={handleChange}
            className={inputClasses}
            placeholder="https://example.com/watch-listing"
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-2">Target Price ($)</label>
          <input
            type="number"
            name="target_price"
            value={formData.target_price}
            onChange={handleChange}
            className={inputClasses}
            placeholder="e.g. 8500"
            min="0"
            step="0.01"
          />
          <p className="text-xs text-zinc-500 mt-1">
            The price you&apos;re willing to pay. You&apos;ll get a visual indicator when current prices are at or below this target.
          </p>
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-2">Status</label>
          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            className={inputClasses}
          >
            <option value="watching">Watching</option>
            <option value="purchased">Purchased</option>
            <option value="removed">Not Interested</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-2">Notes</label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            className={inputClasses}
            rows={3}
            placeholder="Any additional thoughts, preferences, or observations about this watch..."
          />
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg py-3 text-sm font-medium transition-colors"
          >
            {loading ? 'Adding...' : 'Add to Wishlist'}
          </button>

          <Link
            href="/wishlist"
            className="px-6 py-3 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm font-medium transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
