import React from 'react';
import { FileText } from 'lucide-react';
import './OrderNotesCard.css';

export default function OrderNotesCard({ notes }) {
  if (!notes) return null;

  return (
    <div className="order-notes-card">
      <div className="order-notes-card__title">
        <FileText size={16} />
        <span>Delivery Instructions</span>
      </div>
      <p className="order-notes-card__content">{notes}</p>
    </div>
  );
}
