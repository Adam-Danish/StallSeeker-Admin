import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Utensils, Plus, Trash2, ArrowLeft, Power, Star, Store, ImageOff } from 'lucide-react';
import type { Vendor } from './types';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
}

interface StallReview {
  id: string;
  comment: string;
  rating: number | null;
  reviewerName: string;
  createdAt: Date | null;
}

interface VendorDetailProps {
  vendor: Vendor;
  onBack: () => void;
  onSuspend: () => void;
  onReactivate: () => void;
}

function firstImageUrl(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

const imagePlaceholderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#FDF0E8',
  color: '#C7A98A',
};

const ImagePreview: React.FC<{
  src: string;
  alt: string;
  style: React.CSSProperties;
  fallbackIcon?: React.ReactNode;
}> = ({ src, alt, style, fallbackIcon }) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div role="img" aria-label={src ? `${alt} unavailable` : `${alt} not provided`} style={{ ...imagePlaceholderStyle, ...style }}>
        {fallbackIcon ?? <ImageOff size={24} />}
      </div>
    );
  }

  return <img src={src} alt={alt} style={style} onError={() => setFailed(true)} />;
};

export const VendorDetail: React.FC<VendorDetailProps> = ({
  vendor,
  onBack,
  onSuspend,
  onReactivate,
}) => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [reviews, setReviews] = useState<StallReview[]>([]);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');

  const vendorId = vendor.id ?? vendor.vendorId;
  const vendorName = vendor.stallName || vendor.name || 'Vendor';
  const vendorCategory = vendor.category || 'General';
  const vendorHours = vendor.openingHours || vendor.hours || '8:00 AM - 5:00 PM';
  const vendorLatitude = vendor.latitude ?? vendor.lat ?? 0;
  const vendorLongitude = vendor.longitude ?? vendor.lng ?? 0;
  const vendorStatus = Boolean(vendor.isOpen);

  // Fetch menu subcollection in real-time
  useEffect(() => {
    if (!vendorId) return;
    const menuRef = collection(db, 'vendors', vendorId, 'menu');
    const unsubscribe = onSnapshot(menuRef, (snapshot) => {
      const items: MenuItem[] = snapshot.docs.map((d) => ({
        id: d.id,
        name: d.data().name || '',
        price: Number(d.data().price) || 0,
        imageUrl: firstImageUrl(
          d.data().imageUrl,
          d.data().imageURL,
          d.data().photoUrl,
          d.data().photoURL,
          d.data().image,
          d.data().foodImageUrl
        ),
      }));
      setMenuItems(items);
    });
    return () => unsubscribe();
  }, [vendorId]);

  useEffect(() => {
    if (!vendorId) return;

    const reviewsRef = collection(db, 'stallReviews', vendorId, 'entries');
    const unsubscribe = onSnapshot(
      reviewsRef,
      (snapshot) => {
        const vendorReviews = snapshot.docs.map((reviewDoc): StallReview => {
          const data = reviewDoc.data();
          const rawRating = Number(data.rating);
          const updatedAt = data.updatedAt;

          return {
            id: reviewDoc.id,
            comment: String(data.text ?? ''),
            rating: Number.isFinite(rawRating) && rawRating > 0 ? rawRating : null,
            reviewerName: String(data.customerName ?? 'Customer'),
            createdAt: updatedAt && typeof updatedAt.toDate === 'function'
              ? updatedAt.toDate()
              : null,
          };
        });
        vendorReviews.sort(
          (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
        );
        setReviews(vendorReviews);
        setReviewError(null);
      },
      (error) => {
        console.error('Unable to load vendor reviews:', error);
        setReviewError('Reviews could not be loaded. Check your Firebase permissions and try again.');
      }
    );

    return () => unsubscribe();
  }, [vendorId]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId || !newItemName.trim() || !newItemPrice) return;

    await addDoc(collection(db, 'vendors', vendorId, 'menu'), {
      name: newItemName.trim(),
      price: parseFloat(newItemPrice),
    });

    setNewItemName('');
    setNewItemPrice('');
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!vendorId) return;
    await deleteDoc(doc(db, 'vendors', vendorId, 'menu', itemId));
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Back Button */}
      <button
        onClick={onBack}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: '#F05A1A',
          background: 'none',
          border: 'none',
          fontWeight: 600,
          cursor: 'pointer',
          marginBottom: '20px',
        }}
      >
        <ArrowLeft size={16} /> Back to Monitor Vendors
      </button>

      {/* Header Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
          <ImagePreview
            src={vendor.profileImageUrl || vendor.imageUrl || ''}
            alt={`${vendorName} profile picture`}
            style={{ width: '80px', height: '80px', borderRadius: '18px', objectFit: 'cover', flexShrink: 0 }}
            fallbackIcon={<Store size={28} />}
          />
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: '24px', color: '#2D1A0E' }}>{vendorName}</h2>
            <p style={{ margin: 0, color: '#C7A98A', fontSize: '14px' }}>
              📍 {vendorLatitude}, {vendorLongitude}
            </p>
          </div>
        </div>
        <button
          onClick={vendorStatus ? onSuspend : onReactivate}
          style={{
            background: vendorStatus ? '#EF4444' : '#10B981',
            color: '#fff',
            border: 'none',
            padding: '10px 18px',
            borderRadius: '10px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Power size={16} />
          {vendorStatus ? 'Mark as Closed' : 'Mark as Open'}
        </button>
      </div>

      {/* Info Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #EDD9C6' }}>
          <p style={{ color: '#C7A98A', fontSize: '12px', margin: '0 0 6px 0', fontWeight: 600 }}>STATUS</p>
          <p style={{ color: vendorStatus ? '#10B981' : '#EF4444', fontWeight: 700, fontSize: '18px', margin: 0 }}>
            {vendorStatus ? 'Open' : 'Closed'}
          </p>
        </div>
        <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #EDD9C6' }}>
          <p style={{ color: '#C7A98A', fontSize: '12px', margin: '0 0 6px 0', fontWeight: 600 }}>CATEGORY</p>
          <p style={{ color: '#F05A1A', fontWeight: 700, fontSize: '18px', margin: 0 }}>{vendorCategory}</p>
        </div>
        <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #EDD9C6' }}>
          <p style={{ color: '#C7A98A', fontSize: '12px', margin: '0 0 6px 0', fontWeight: 600 }}>HOURS</p>
          <p style={{ color: '#2D1A0E', fontWeight: 700, fontSize: '18px', margin: 0 }}>{vendorHours}</p>
        </div>
      </div>

      {/* 🍔 MANAGE MENU SECTION */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #EDD9C6', padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{ background: '#FDF0E8', padding: '8px', borderRadius: '8px', color: '#F05A1A' }}>
            <Utensils size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#2D1A0E' }}>Manage Stall Menu</h3>
            <p style={{ margin: 0, fontSize: '12px', color: '#C7A98A' }}>Add or delete food items offered by this vendor</p>
          </div>
        </div>

        {/* Add Item Form */}
        <form onSubmit={handleAddItem} style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <input
            type="text"
            placeholder="Item Name (e.g. Nasi Lemak Biasa)"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            style={{
              flex: 2,
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid #EDD9C6',
              outline: 'none',
              fontSize: '14px',
            }}
          />
          <input
            type="number"
            step="0.01"
            placeholder="Price (RM)"
            value={newItemPrice}
            onChange={(e) => setNewItemPrice(e.target.value)}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid #EDD9C6',
              outline: 'none',
              fontSize: '14px',
            }}
          />
          <button
            type="submit"
            style={{
              background: '#F05A1A',
              color: '#fff',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Plus size={16} /> Add Item
          </button>
        </form>

        {/* Menu Items List */}
        {menuItems.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#C7A98A', padding: '20px 0', margin: 0, fontSize: '14px' }}>
            No menu items found. Add one above!
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
            {menuItems.map((item) => (
              <div
                key={item.id}
                style={{
                  overflow: 'hidden',
                  background: '#fff',
                  borderRadius: '12px',
                  border: '1px solid #EDD9C6',
                }}
              >
                <ImagePreview
                  src={item.imageUrl}
                  alt={`${item.name || 'Menu item'} photo`}
                  style={{ width: '100%', height: '180px', objectFit: 'cover' }}
                  fallbackIcon={<Utensils size={28} />}
                />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 14px' }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, color: '#2D1A0E', fontSize: '14px' }}>
                      {item.name || 'Menu item'}
                    </p>
                    <span style={{ display: 'inline-block', marginTop: '4px', fontWeight: 700, color: '#F05A1A', fontSize: '14px' }}>
                      RM {item.price.toFixed(2)}
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label={`Delete ${item.name || 'menu item'}`}
                    onClick={() => handleDeleteItem(item.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#EF4444',
                      cursor: 'pointer',
                      padding: '4px',
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #EDD9C6', padding: '24px', marginTop: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{ background: '#FDF0E8', padding: '8px', borderRadius: '8px', color: '#F05A1A' }}>
            <Star size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#2D1A0E' }}>Customer Reviews</h3>
            <p style={{ margin: 0, fontSize: '12px', color: '#C7A98A' }}>
              {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'} for this vendor
            </p>
          </div>
        </div>

        {reviewError ? (
          <p role="alert" style={{ color: '#B42318', textAlign: 'center', padding: '20px 0', margin: 0, fontSize: '14px' }}>
            {reviewError}
          </p>
        ) : reviews.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#C7A98A', padding: '20px 0', margin: 0, fontSize: '14px' }}>
            No reviews found for this vendor.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {reviews.map((review) => (
              <div
                key={review.id}
                style={{ padding: '14px 16px', background: '#FDF0E8', borderRadius: '10px', border: '1px solid #EDD9C6' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 700, color: '#2D1A0E', fontSize: '14px' }}>{review.reviewerName}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {review.rating !== null && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#F05A1A', fontWeight: 700, fontSize: '13px' }}>
                        <Star size={14} fill="currentColor" /> {review.rating}
                      </span>
                    )}
                    {review.createdAt && (
                      <span style={{ color: '#9B7B5B', fontSize: '12px' }}>
                        {review.createdAt.toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <p style={{ margin: 0, color: '#7A5C2E', fontSize: '14px', lineHeight: 1.5 }}>
                  {review.comment || 'No written comment.'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};