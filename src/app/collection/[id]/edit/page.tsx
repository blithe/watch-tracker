'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Watch {
  id: number;
  brand: string;
  model: string;
  reference: string | null;
  image_url: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  sold_date: string | null;
  sold_price: number | null;
  status: string;
  notes: string | null;
}

export default function EditWatchPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  
  const [watch, setWatch] = useState<Watch | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showSoldFields, setShowSoldFields] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    brand: '',
    model: '',
    reference: '',
    image_url: '',
    purchase_date: '',
    purchase_price: '',
    sold_date: '',
    sold_price: '',
    status: 'owned',
    notes: ''
  });

  useEffect(() => {
    if (id) {
      fetchWatch();
    }
  }, [id]);

  useEffect(() => {
    if (watch) {
      setFormData({
        brand: watch.brand || '',
        model: watch.model || '',
        reference: watch.reference || '',
        image_url: watch.image_url || '',
        purchase_date: watch.purchase_date || '',
        purchase_price: watch.purchase_price?.toString() || '',
        sold_date: watch.sold_date || '',
        sold_price: watch.sold_price?.toString() || '',
        status: watch.status || 'owned',
        notes: watch.notes || ''
      });
      setShowSoldFields(watch.status === 'sold');
    }
  }, [watch]);

  async function fetchWatch() {
    try {
      const response = await fetch(`/api/watches/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch watch details');
      }
      const data = await response.json();
      setWatch(data.watch);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleMarkAsSold = () => {
    if (!showSoldFields) {
      setShowSoldFields(true);
      setFormData(prev => ({
        ...prev,
        status: 'sold',
        sold_date: new Date().toISOString().split('T')[0]
      }));
    } else {
      setShowSoldFields(false);
      setFormData(prev => ({
        ...prev,
        status: 'owned',
        sold_date: '',
        sold_price: ''
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      // Prepare data for API
      const updateData: any = {
        brand: formData.brand,
        model: formData.model,
        reference: formData.reference || null,
        image_url: formData.image_url || null,
        purchase_date: formData.purchase_date || null,
        purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
        status: formData.status,
        notes: formData.notes || null
      };

      if (formData.status === 'sold') {
        updateData.sold_date = formData.sold_date || null;
        updateData.sold_price = formData.sold_price ? parseFloat(formData.sold_price) : null;
      } else {
        updateData.sold_date = null;
        updateData.sold_price = null;
      }

      const response = await fetch(`/api/watches/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        throw new Error('Failed to update watch');
      }

      router.push(`/collection/${id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-zinc-400">Loading watch...</div>
      </div>
    );
  }

  if (!watch) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
        <p className="text-red-400">Watch not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link
          href={`/collection/${id}`}
          className="text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          ← Back to Watch
        </Link>
      </div>

      <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-6">
        <h1 className="text-2xl font-bold mb-6">Edit Watch</h1>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Reference
            </label>
            <input
              type="text"
              name="reference"
              value={formData.reference}
              onChange={handleInputChange}
              className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Image URL
            </label>
            <input
              type="url"
              name="image_url"
              value={formData.image_url}
              onChange={handleInputChange}
              className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://..."
            />
          </div>

          {/* Purchase Info */}
          <div className="border-t border-zinc-700 pt-6">
            <h3 className="text-lg font-medium mb-4">Purchase Information</h3>
            
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

          {/* Sold Info */}
          <div className="border-t border-zinc-700 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Sale Information</h3>
              <button
                type="button"
                onClick={handleMarkAsSold}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  showSoldFields
                    ? 'bg-zinc-600 hover:bg-zinc-500 text-zinc-200'
                    : 'bg-red-600 hover:bg-red-500 text-white'
                }`}
              >
                {showSoldFields ? 'Mark as Owned' : 'Mark as Sold'}
              </button>
            </div>

            {showSoldFields && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Sold Date
                  </label>
                  <input
                    type="date"
                    name="sold_date"
                    value={formData.sold_date}
                    onChange={handleInputChange}
                    className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Sold Price ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="sold_price"
                    value={formData.sold_price}
                    onChange={handleInputChange}
                    className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={4}
              className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Any additional notes about this watch..."
            />
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            
            <Link
              href={`/collection/${id}`}
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