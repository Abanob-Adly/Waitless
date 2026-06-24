import { useState } from 'react';
import './PaymentSection.css';

interface Booking {
  doctorName: string;
  specialty:  string;
  date:       string;
  time:       string;
  clinic:     string;
  area:       string;
  fee:        number;
}

interface PaymentMethod {
  id:    string;
  label: string;
}

interface CardData {
  name:       string;
  cardNumber: string;
  expiry:     string;
  cvv:        string;
}

interface PayData {
  method:   string;
  cardData?: CardData;
}

interface PaymentSectionProps {
  booking?:        Booking;
  paymentMethods?: PaymentMethod[];
  onPay?:          (data: PayData) => void;
}

function getInitials(name: string = ''): string {
  return name.replace(/^Dr\.?\s*/i, '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const DEFAULT_METHODS: PaymentMethod[] = [
  { id: 'card',     label: '💳 Credit/Debit' },
  { id: 'vodafone', label: '📱 Vodafone Cash' },
  { id: 'clinic',   label: '🏥 Pay at Clinic' },
];

const DEFAULT_BOOKING: Booking = {
  doctorName: 'Dr. Layla Hassan',
  specialty:  'Consultant Cardiologist',
  date:       'Mon, Mar 16',
  time:       '09:30 AM',
  clinic:     'Layla Hassan Heart Center',
  area:       'Maadi, Cairo',
  fee:        350,
};

export default function PaymentSection({
  booking        = DEFAULT_BOOKING,
  paymentMethods = DEFAULT_METHODS,
  onPay,
}: PaymentSectionProps) {
  const [activeMethod, setActiveMethod] = useState<string>(paymentMethods[0]?.id ?? '');
  const [form, setForm] = useState<CardData>({ name: '', cardNumber: '', expiry: '', cvv: '' });

  function handleField(key: keyof CardData) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  function handlePay(): void {
    onPay?.({ method: activeMethod, cardData: form });
  }

  return (
    <section className="payment-section">
      <div className="payment-container">

        {/* ── Left: Payment Form ── */}
        <div className="payment-card">
          <div className="payment-header">
            <h2>Complete Payment</h2>
            <p>Secure checkout · Fast booking · Instant confirmation</p>
          </div>

          {/* Method tabs */}
          <div className="payment-methods">
            {paymentMethods.map((m) => (
              <button
                key={m.id}
                className={`payment-method${activeMethod === m.id ? ' payment-method--active' : ''}`}
                onClick={() => setActiveMethod(m.id)}
                type="button"
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Card form */}
          {activeMethod === 'card' && (
            <div className="payment-form">
              <div className="payment-field">
                <label>Cardholder Name *</label>
                <input type="text" placeholder="As printed on card"
                  value={form.name} onChange={handleField('name')} />
              </div>
              <div className="payment-field">
                <label>Card Number *</label>
                <input type="text" placeholder="0000 0000 0000 0000"
                  value={form.cardNumber} onChange={handleField('cardNumber')} maxLength={19} />
              </div>
              <div className="payment-row">
                <div className="payment-field">
                  <label>Expiry *</label>
                  <input type="text" placeholder="MM / YY"
                    value={form.expiry} onChange={handleField('expiry')} maxLength={7} />
                </div>
                <div className="payment-field">
                  <label>CVV *</label>
                  <input type="password" placeholder="•••"
                    value={form.cvv} onChange={handleField('cvv')} maxLength={4} />
                </div>
              </div>
              <button className="payment-btn" type="button" onClick={handlePay}>
                Pay {booking.fee} EGP
              </button>
              <p className="payment-note">256-bit SSL · PCI DSS compliant</p>
            </div>
          )}

          {/* Non-card methods */}
          {activeMethod !== 'card' && (
            <div className="payment-form">
              <button className="payment-btn" type="button" onClick={handlePay}>
                Confirm — Pay {booking.fee} EGP
              </button>
              <p className="payment-note">
                {activeMethod === 'clinic'
                  ? 'Pay in person at the clinic'
                  : 'A Vodafone Cash prompt will be sent to your phone'}
              </p>
            </div>
          )}
        </div>

        {/* ── Right: Order Summary ── */}
        <div className="order-summary">
          <h3>Order Summary</h3>

          <div className="summary-doctor">
            <div className="summary-avatar">{getInitials(booking.doctorName)}</div>
            <div>
              <h4>{booking.doctorName}</h4>
              <p>{booking.specialty}</p>
            </div>
          </div>

          <div className="summary-details">
            <div className="summary-row"><span>📅 Date</span><strong>{booking.date}</strong></div>
            <div className="summary-row"><span>⏰ Time</span><strong>{booking.time}</strong></div>
            <div className="summary-row"><span>📍 Clinic</span><strong>{booking.clinic}</strong></div>
            <div className="summary-row"><span>📌 Area</span><strong>{booking.area}</strong></div>
          </div>

          <div className="summary-total">
            <span>Total</span>
            <h2>{booking.fee} EGP</h2>
          </div>
        </div>

      </div>
    </section>
  );
}