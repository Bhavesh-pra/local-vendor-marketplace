import { useState, useEffect } from 'react';
import { Save, Building, DollarSign, CreditCard } from 'lucide-react';
import { useToast } from '../../../hooks/useToast.js';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle.js';
import { Spinner } from '../../../components/ui/Spinner/index.jsx';
import './index.css';

const STORAGE_KEY = 'shopcart_admin_settings';

const DEFAULT_SETTINGS = {
  storeName: 'ShopCart E-Commerce',
  supportEmail: 'support@shopcart.com',
  currency: 'INR',
  reorderThreshold: 10,
  codEnabled: true,
  upiEnabled: true,
};

export default function SettingsPage() {
  useDocumentTitle('Settings — ShopCart Admin');
  const { showToast } = useToast();

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(() => {
    return localStorage.getItem(STORAGE_KEY + '_last_saved') || '26 Jun 2026';
  });

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
      } catch (err) {
        console.error('Failed to parse settings', err);
      }
    }
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    setSaving(true);

    // Simulate save duration for premium feel
    setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      const savedDate = new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
      localStorage.setItem(STORAGE_KEY + '_last_saved', savedDate);
      setLastSaved(savedDate);
      setSaving(false);
      showToast('success', 'Store configuration saved successfully!');
    }, 800);
  };

  return (
    <div className="settings-page">
      <header className="ap-header">
        <div>
          <h1 className="ap-title">Store Settings</h1>
          <p className="ap-subtitle">Configure store identity, parameters, and payment preferences</p>
        </div>
      </header>

      <form onSubmit={handleSave} className="settings-grid">
        {/* Left column: main configurations */}
        <div className="settings-column">
          {/* Card 1: Store Identity */}
          <div className="ap-card settings-card">
            <div className="settings-card__header">
              <Building size={18} className="settings-card__icon" />
              <h3>Store Identity</h3>
            </div>
            
            <div className="ap-field">
              <label className="ap-label" htmlFor="storeName">Store Name *</label>
              <input
                id="storeName"
                name="storeName"
                type="text"
                className="ap-input"
                required
                value={settings.storeName}
                onChange={handleChange}
                placeholder="e.g. ShopCart Prime"
              />
            </div>

            <div className="ap-field">
              <label className="ap-label" htmlFor="supportEmail">Support Email Address *</label>
              <input
                id="supportEmail"
                name="supportEmail"
                type="email"
                className="ap-input"
                required
                value={settings.supportEmail}
                onChange={handleChange}
                placeholder="e.g. contact@mystore.com"
              />
            </div>
          </div>

          {/* Card 2: Operations parameters */}
          <div className="ap-card settings-card">
            <div className="settings-card__header">
              <DollarSign size={18} className="settings-card__icon" />
              <h3>Parameters & Valuation</h3>
            </div>

            <div className="ap-field">
              <label className="ap-label" htmlFor="currency">Base Currency</label>
              <select
                id="currency"
                name="currency"
                className="ap-select"
                value={settings.currency}
                onChange={handleChange}
              >
                <option value="INR">INR (₹) - Indian Rupee</option>
                <option value="USD">USD ($) - US Dollar</option>
                <option value="EUR">EUR (€) - Euro</option>
                <option value="GBP">GBP (£) - British Pound</option>
              </select>
            </div>

            <div className="ap-field">
              <label className="ap-label" htmlFor="reorderThreshold">Default Reorder Threshold *</label>
              <input
                id="reorderThreshold"
                name="reorderThreshold"
                type="number"
                min="0"
                className="ap-input"
                required
                value={settings.reorderThreshold}
                onChange={handleChange}
                placeholder="e.g. 10"
              />
              <span className="settings-form__hint">
                Variants falling below this stock level will trigger a Low Stock alert.
              </span>
            </div>
          </div>
        </div>

        {/* Right column: Payments */}
        <div className="settings-column">
          <div className="ap-card settings-card">
            <div className="settings-card__header">
              <CreditCard size={18} className="settings-card__icon" />
              <h3>Payment Preferences</h3>
            </div>
            <p className="settings-card__desc">
              Enable or disable default checkout payment modes.
            </p>

            <div className="settings-toggle-field">
              <div className="settings-toggle-info">
                <span className="settings-toggle-label">Cash on Delivery (COD)</span>
                <span className="settings-toggle-desc">Allow customers to pay physical cash upon package receipt</span>
              </div>
              <label className="settings-switch">
                <input
                  name="codEnabled"
                  type="checkbox"
                  checked={settings.codEnabled}
                  onChange={handleChange}
                />
                <span className="settings-slider"></span>
              </label>
            </div>

            <div className="settings-toggle-field" style={{ marginTop: '20px' }}>
              <div className="settings-toggle-info">
                <span className="settings-toggle-label">UPI / Instant Transfer</span>
                <span className="settings-toggle-desc">Allow customers to scan UPI QR or input VPA handles</span>
              </div>
              <label className="settings-switch">
                <input
                  name="upiEnabled"
                  type="checkbox"
                  checked={settings.upiEnabled}
                  onChange={handleChange}
                />
                <span className="settings-slider"></span>
              </label>
            </div>
          </div>

          {/* Form Actions */}
          <div className="settings-actions">
            <button
              type="submit"
              className="ap-btn ap-btn--primary settings-save-btn"
              disabled={saving}
            >
              {saving ? (
                <>
                  <Spinner size="sm" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save size={16} style={{ marginRight: '8px' }} />
                  <span>Save Configuration</span>
                </>
              )}
            </button>
            {lastSaved && (
              <span className="settings-last-saved" style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '8px', display: 'block', textAlign: 'right' }}>
                Last Saved: {lastSaved}
              </span>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
