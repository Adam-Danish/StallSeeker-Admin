import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Utensils, Plus, Trash2, ArrowLeft, Power } from 'lucide-react';
import type { Vendor } from './types';

interface MenuItem {
  id: string;
  name: string;
  price: number;
}

interface VendorDetailProps {
  vendor: Vendor;
  onBack: () => void;
  onSuspend: () => void;
  onReactivate: () => void;
}

export const VendorDetail: React.FC<VendorDetailProps> = ({
  vendor,
  onBack,
  onSuspend,
  onReactivate,
}) => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
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
      }));
      setMenuItems(items);
    });
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px', color: '#2D1A0E' }}>{vendorName}</h2>
          <p style={{ margin: 0, color: '#C7A98A', fontSize: '14px' }}>
            📍 {vendorLatitude}, {vendorLongitude}
          </p>
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
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #EDD9C6', padding: '24px' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {menuItems.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  background: '#FDF0E8',
                  borderRadius: '10px',
                  border: '1px solid #EDD9C6',
                }}
              >
                <span style={{ fontWeight: 600, color: '#2D1A0E', fontSize: '14px' }}>{item.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{ fontWeight: 700, color: '#F05A1A', fontSize: '14px' }}>
                    RM {item.price.toFixed(2)}
                  </span>
                  <button
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
    </div>
  );
};