import React from 'react';
import { FileDown, Info } from 'lucide-react';
import './InvoiceCard.css';

export default function InvoiceCard() {
  return (
    <div className="invoice-card">
      <h3 className="invoice-card__title">Invoice</h3>
      
      <div className="invoice-card__info-box">
        <Info size={14} className="invoice-card__info-icon" />
        <p className="invoice-card__text">
          Downloadable invoices will be available soon.
        </p>
      </div>

      <button className="btn btn--outline invoice-card__btn" disabled type="button">
        <FileDown size={14} />
        <span>Download Invoice</span>
      </button>
    </div>
  );
}
