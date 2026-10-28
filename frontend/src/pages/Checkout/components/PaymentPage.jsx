import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageLayout } from '../../../components/layout/PageLayout/index.jsx';
import { Spinner } from '../../../components/ui/Spinner/index.jsx';
import { useToast } from '../../../hooks/useToast.js';
import { getOrder } from '../../../services/orderService.js';
import { initiatePayment, simulatePayment, retryPayment } from '../../../services/paymentService.js';
import { formatCurrency } from '../../../utils/formatters.js';
import { ShieldCheck, AlertCircle, RefreshCw, CreditCard, Smartphone, Wallet as WalletIcon, CheckCircle } from 'lucide-react';
import './PaymentPage.css';

export function PaymentPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [order, setOrder] = useState(null);
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  // Simulator configurations
  const [outcome, setOutcome] = useState('success');
  const [failureReason, setFailureReason] = useState('insufficient_funds');
  const [selectedMethod, setSelectedMethod] = useState('');
  const [mode, setMode] = useState('manual'); // manual, random, deterministic

  const fetchPaymentDetails = useCallback(async () => {
    setLoading(true);
    try {
      const orderData = await getOrder(orderId);
      setOrder(orderData);
      setSelectedMethod(orderData.payment_method);

      // Attempt to initiate/retrieve the payment attempt
      try {
        const payData = await initiatePayment(orderId, orderData.payment_method, `initiate-${orderId}`);
        setPayment(payData);
      } catch (payErr) {
        console.warn('Initiate failed, possibly already initiated:', payErr.message);
      }
    } catch (err) {
      showToast('error', 'Failed to retrieve payment details.');
    } finally {
      setLoading(false);
    }
  }, [orderId, showToast]);

  useEffect(() => {
    fetchPaymentDetails();
  }, [fetchPaymentDetails]);

  const handleSimulate = async () => {
    if (!payment) return;
    setProcessing(true);
    showToast('info', 'Connecting to secure mock gateway...');

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    let finalOutcome = outcome;
    let finalReason = failureReason;

    // Apply simulation rules
    if (mode === 'random') {
      const outcomesList = ['success', 'failure', 'timeout', 'cancelled'];
      finalOutcome = outcomesList[Math.floor(Math.random() * outcomesList.length)];
      if (finalOutcome !== 'success') {
        const reasons = ['insufficient_funds', 'bank_timeout', 'gateway_unavailable', 'user_cancelled'];
        finalReason = reasons[Math.floor(Math.random() * reasons.length)];
      }
    } else if (mode === 'deterministic') {
      // Deterministic testing rules
      if (order?.total_amount > 5000) {
        finalOutcome = 'failure';
        finalReason = 'daily_limit_exceeded';
      } else {
        finalOutcome = 'success';
      }
    }

    try {
      await simulatePayment(payment.payment_id, finalOutcome, finalOutcome === 'success' ? null : finalReason);
      setProcessing(false);

      if (finalOutcome === 'success') {
        showToast('success', 'Payment authorized and completed successfully!');
        navigate(`/order-success/${orderId}`, { replace: true });
      } else {
        showToast('error', `Payment declined: ${finalReason.replace(/_/g, ' ')}`);
        // Refresh details to show failed state
        fetchPaymentDetails();
      }
    } catch (err) {
      setProcessing(false);
      showToast('error', 'Failed to process simulation: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleRetry = async () => {
    setLoading(true);
    const key = `retry-${orderId}-${Date.now()}`;
    try {
      const payData = await retryPayment(orderId, selectedMethod, key);
      setPayment(payData);
      showToast('success', `Switched payment method to ${selectedMethod}. Please complete payment.`);
      fetchPaymentDetails();
    } catch (err) {
      showToast('error', 'Retry failed: ' + (err.response?.data?.message || err.message));
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <PageLayout>
        <div className="payment-page__loading">
          <Spinner size="lg" />
          <p>Contacting payment server...</p>
        </div>
      </PageLayout>
    );
  }

  const getMethodIcon = (method) => {
    switch (method) {
      case 'UPI': return <Smartphone className="payment-icon" size={24} />;
      case 'CARD': return <CreditCard className="payment-icon" size={24} />;
      case 'WALLET': return <WalletIcon className="payment-icon" size={24} />;
      default: return <CreditCard className="payment-icon" size={24} />;
    }
  };

  return (
    <PageLayout>
      <div className="payment-container">
        <div className="payment-card glassmorphism">
          <div className="payment-card__header">
            <ShieldCheck size={36} className="secure-badge" />
            <h2 className="payment-title">Mock Secure Checkout</h2>
            <p className="payment-subtitle">Deterministic Simulator Sandbox</p>
          </div>

          <div className="payment-details">
            <div className="detail-row">
              <span className="detail-label">Order Reference:</span>
              <span className="detail-value font-mono">{order?.order_number}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Total Payable:</span>
              <span className="detail-value total-amount">{formatCurrency(order?.total_amount)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Selected Method:</span>
              <span className="detail-value method-pill">
                {getMethodIcon(payment?.payment_method)}
                {payment?.payment_method}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Payment Status:</span>
              <span className={`status-pill status-${payment?.status}`}>
                {payment?.status?.toUpperCase()}
              </span>
            </div>
          </div>

          {/* If payment failed/cancelled, show retry selector */}
          {(payment?.status === 'failed' || payment?.status === 'cancelled' || payment?.status === 'expired') ? (
            <div className="retry-pane">
              <div className="alert-box">
                <AlertCircle size={20} className="alert-icon" />
                <p>The previous payment attempt was declined/cancelled. Select a method to retry.</p>
              </div>

              <div className="method-picker">
                {['UPI', 'CARD', 'WALLET'].map(m => (
                  <button
                    key={m}
                    className={`method-btn ${selectedMethod === m ? 'method-btn--active' : ''}`}
                    onClick={() => setSelectedMethod(m)}
                    type="button"
                  >
                    {m}
                  </button>
                ))}
              </div>

              <button
                onClick={handleRetry}
                className="retry-submit-btn"
                type="button"
                disabled={processing}
              >
                <RefreshCw size={18} className="btn-icon" />
                Confirm & Re-initiate Payment
              </button>
            </div>
          ) : (
            <div className="simulator-controls">
              <div className="form-group">
                <label className="form-label">Simulation Mode:</label>
                <div className="mode-toggle">
                  {['manual', 'random', 'deterministic'].map(m => (
                    <button
                      key={m}
                      className={`mode-btn ${mode === m ? 'mode-btn--active' : ''}`}
                      onClick={() => setMode(m)}
                      type="button"
                    >
                      {m.toUpperCase()}
                    </button>
                  ))}
                </div>
                <p className="helper-text text-muted">
                  {mode === 'manual' && 'Manually select outcomes and fail reasons.'}
                  {mode === 'random' && 'Gateway randomizes success, timeouts, and failures.'}
                  {mode === 'deterministic' && 'Rules-based: Orders > ₹5000 fail with Daily Limit Exceeded. Others succeed.'}
                </p>
              </div>

              {mode === 'manual' && (
                <>
                  <div className="form-group">
                    <label className="form-label" htmlFor="outcome-select">Expected Outcome:</label>
                    <select
                      id="outcome-select"
                      className="simulator-select"
                      value={outcome}
                      onChange={(e) => setOutcome(e.target.value)}
                    >
                      <option value="success">Success (Capture & Settle)</option>
                      <option value="failure">Declined / Failed</option>
                      <option value="timeout">Gateway Network Timeout</option>
                      <option value="cancelled">User Aborted / Cancelled</option>
                      <option value="expired">Session Expired</option>
                    </select>
                  </div>

                  {outcome !== 'success' && (
                    <div className="form-group">
                      <label className="form-label" htmlFor="reason-select">Failure Code:</label>
                      <select
                        id="reason-select"
                        className="simulator-select"
                        value={failureReason}
                        onChange={(e) => setFailureReason(e.target.value)}
                      >
                        <option value="insufficient_funds">Insufficient Funds</option>
                        <option value="bank_timeout">Bank Connection Timed Out</option>
                        <option value="gateway_unavailable">Payment Gateway Unavailable</option>
                        <option value="invalid_credentials">Incorrect Card Pins / Credentials</option>
                        <option value="daily_limit_exceeded">Daily Limit Exceeded</option>
                        <option value="user_cancelled">Transaction Cancelled by Customer</option>
                        <option value="fraud_check_failed">Risk engine / Fraud check failed</option>
                      </select>
                    </div>
                  )}
                </>
              )}

              <button
                onClick={handleSimulate}
                className={`simulate-btn ${outcome === 'success' || mode !== 'manual' ? 'simulate-btn--success' : 'simulate-btn--danger'}`}
                type="button"
                disabled={processing}
              >
                {processing ? (
                  <>
                    <Spinner size="sm" className="btn-spinner" />
                    Authorizing Transaction...
                  </>
                ) : (
                  <>
                    <CheckCircle size={18} className="btn-icon" />
                    Process Simulation
                  </>
                )}
              </button>
            </div>
          )}

          <div className="payment-security-footer">
            <p>🔒 Sandbox transactions do not carry actual monetary value.</p>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
export default PaymentPage;
