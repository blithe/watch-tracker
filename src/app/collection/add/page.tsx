'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AddWatchPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    brand: '',
    model: '',
    reference: '',
    purchase_date: '',
    purchase_price: '',
    notes: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

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

      const watchData = {
        brand: formData.brand,
        model: formData.model,
        reference: formData.reference || null,
        image_url,
        purchase_date: formData.purchase_date || null,
        purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
        status: 'owned',
        notes: formData.notes || null
      };

      const response = await fetch('/api/watches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(watchData)
      });

      if (!response.ok) {
        throw new Error('Failed to add watch');
      }

      router.push('/collection');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/collection"
          className="text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          ← Back to Collection
        </Link>
      </div>

      <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-6">
        <h1 className="text-2xl font-bold mb-6">Add Watch to Collection</h1>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div>
            <h3 className="text-lg font-medium mb-4">Watch Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Brand *
                </label>
                <input
                  type="text"
                  name="brand"
                  value={formData.brand}
                  onChange={handleInputChange}
                  required
                  className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Rolex, Omega, Seiko"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Model *
                </label>
                <input
                  type="text"
                  name="model"
                  value={formData.model}
                  onChange={handleInputChange}
                  required
                  className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Submariner, Speedmaster"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Reference Number
              </label>
              <input
                type="text"
                name="reference"
                value={formData.reference}
                onChange={handleInputChange}
                className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 116610LN, 311.30.42.30.01.005"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Photo
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={e => setPhoto(e.target.files?.[0] ?? null)}
                className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 file:mr-3 file:rounded file:border-0 file:bg-zinc-600 file:text-zinc-100 file:px-3 file:py-1 file:text-sm"
              />
              {photo && (
                <img
                  src={URL.createObjectURL(photo)}
                  alt="Preview"
                  className="mt-2 h-32 rounded-lg object-cover"
                />
              )}
            </div>
          </div>

          {/* Purchase Info */}
          <div className="border-t border-zinc-700 pt-6">
            <h3 className="text-lg font-medium mb-4">Purchase Information</h3>
            <p className="text-sm text-zinc-400 mb-4">
              This information helps track the value and performance of your collection.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Purchase Date
                </label>
                <input
                  type="date"
                  name="purchase_date"
                  value={formData.purchase_date}
                  onChange={handleInputChange}
                  className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Purchase Price ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="purchase_price"
                  value={formData.purchase_price}
                  onChange={handleInputChange}
                  className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="border-t border-zinc-700 pt-6">
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={4}
              className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Any additional notes about this watch - where you bought it, special occasions, etc."
            />
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {saving ? 'Adding...' : 'Add to Collection'}
            </button>
            
            <Link
              href="/collection"
              className="px-4 py-2 bg-zinc-600 hover:bg-zinc-500 rounded-lg font-medium transition-colors text-center"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}