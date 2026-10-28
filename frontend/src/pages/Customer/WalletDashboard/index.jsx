import React, { useState, useEffect, useCallback } from 'react';
import { PageLayout } from '../../../components/layout/PageLayout/index.jsx';
import { Spinner } from '../../../components/ui/Spinner/index.jsx';
import { useToast } from '../../../hooks/useToast.js';
import { getWalletBalance, getWalletHistory, walletDeposit } from '../../../services/paymentService.js';
import { formatCurrency } from '../../../utils/formatters.js';
import { PlusCircle, Wallet, ArrowUpRight, ArrowDownLeft, Receipt, Calendar } from 'lucide-react';
import './index.css';

export function WalletDashboard() {
  const { showToast } = useToast();
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [depositing, setDepositing] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');

  const fetchWalletDetails = useCallback(async () => {
    try {
      const [balRes, histRes] = await Promise.all([
        getWalletBalance(),
        getWalletHistory()
      ]);
      setBalance(balRes.balance);
      setHistory(histRes);
    } catch (err) {
      showToast('error', 'Failed to retrieve wallet information.');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchWalletDetails();
  }, [fetchWalletDetails]);

  const handleDepositSubmit = async (e) => {
    if (e) e.preventDefault();
    const parsedAmount = parseFloat(depositAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      showToast('error', 'Please enter a valid deposit amount.');
      return;
    }

    setDepositing(true);
    const key = `deposit-${Date.now()}`;
    try {
      await walletDeposit(parsedAmount, key);
      showToast('success', `Successfully deposited ${formatCurrency(parsedAmount)} to your wallet!`);
      setDepositAmount('');
      await fetchWalletDetails();
    } catch (err) {
      showToast('error', 'Deposit failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setDepositing(false);
    }
  };

  const applyPreset = (amount) => {
    setDepositAmount(amount.toString());
  };

  if (loading) {
    return (
      <PageLayout>
        <div className="wallet-page__loading">
          <Spinner size="lg" />
          <p>Loading wallet ledger...</p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="wallet-layout">
        <div className="wallet-header-card glassmorphism">
          <div className="wallet-header-left">
            <div className="wallet-icon-wrap">
              <Wallet size={32} className="wallet-icon" />
            </div>
            <div>
              <h2 className="wallet-title">Internal Digital Wallet</h2>
              <p className="wallet-subtitle">Secure, instant one-click transactions</p>
            </div>
          </div>
          <div className="wallet-balance-wrap">
            <span className="balance-label">Current Balance</span>
            <span className="balance-val">{formatCurrency(balance)}</span>
          </div>
        </div>

        <div className="wallet-grid">
          {/* Deposit panel */}
          <div className="wallet-card glassmorphism deposit-card">
            <h3 className="card-title">Add Funds</h3>
            <form onSubmit={handleDepositSubmit} className="deposit-form">
              <div className="form-group">
                <label className="form-label" htmlFor="deposit-amount-input">Amount (INR):</label>
                <div className="amount-input-wrapper">
                  <span className="currency-prefix">₹</span>
                  <input
                    id="deposit-amount-input"
                    type="number"
                    min="1"
                    step="any"
                    className="amount-input"
                    placeholder="Enter amount to add"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    disabled={depositing}
                  />
                </div>
              </div>

              <div className="preset-buttons">
                {[100, 500, 1000, 5000].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    className="preset-btn"
                    onClick={() => applyPreset(amt)}
                    disabled={depositing}
                  >
                    +₹{amt}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                className="deposit-submit-btn"
                disabled={depositing}
              >
                {depositing ? (
                  <>
                    <Spinner size="sm" className="btn-spinner" />
                    Processing Deposit...
                  </>
                ) : (
                  <>
                    <PlusCircle size={18} />
                    Deposit to Wallet
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Ledger History list */}
          <div className="wallet-card glassmorphism history-card">
            <h3 className="card-title">Transaction Ledger</h3>
            <div className="ledger-list">
              {history.length === 0 ? (
                <div className="empty-ledger">
                  <Receipt size={48} className="empty-icon" />
                  <p className="empty-text">No transactions found</p>
                  <p className="empty-subtext">Add funds to start shopping instantly!</p>
                </div>
              ) : (
                history.map((tx) => {
                  const isCredit = ['deposit', 'refund', 'adjustment_credit'].includes(tx.type);
                  return (
                    <div key={tx.id} className="ledger-item">
                      <div className="ledger-item__left">
                        <div className={`tx-indicator ${isCredit ? 'tx-indicator--credit' : 'tx-indicator--debit'}`}>
                          {isCredit ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}
                        </div>
                        <div>
                          <p className="tx-type-label">
                            {tx.type.replace(/_/g, ' ').toUpperCase()}
                          </p>
                          <p className="tx-ref font-mono text-muted text-xs">
                            Ref: {tx.reference_id || 'N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="ledger-item__right">
                        <span className={`tx-amount-label ${isCredit ? 'tx-amount-credit' : 'tx-amount-debit'}`}>
                          {isCredit ? '+' : '-'}{formatCurrency(tx.amount)}
                        </span>
                        <span className="tx-date-label">
                          <Calendar size={12} className="date-icon" />
                          {new Date(tx.created_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
export default WalletDashboard;
