import './LiveTicket.css';

/**
 * LiveTicket — Waitless UI Kit (Abanob's Module)
 *
 * @prop {string}   doctorName      - e.g. "Dr. Layla Hassan"
 * @prop {string}   specialty       - e.g. "Cardiology"
 * @prop {string}   location        - e.g. "Maadi"
 * @prop {number}   queuePosition   - patient's current position (1-based)
 * @prop {number}   totalInQueue    - total patients in queue (for progress bar)
 * @prop {string}   estimatedWait   - formatted wait string e.g. "~36m"
 * @prop {number}   fee             - consultation fee in EGP
 * @prop {boolean}  isLive          - shows Live badge (default true)
 * @prop {function} onCancel        - called when Cancel button is clicked
 *
 * @example
 * <LiveTicket
 *   doctorName="Dr. Layla Hassan"
 *   specialty="Cardiology"
 *   location="Maadi"
 *   queuePosition={3}
 *   totalInQueue={8}
 *   estimatedWait="~36m"
 *   fee={350}
 *   onCancel={() => handleCancelBooking()}
 * />
 */
export default function LiveTicket({
  doctorName    = 'Dr. Layla Hassan',
  specialty     = 'Cardiology',
  location      = 'Maadi',
  queuePosition = 3,
  totalInQueue  = 8,
  estimatedWait = '~36m',
  fee           = 350,
  isLive        = true,
  onCancel,
}) {
  // Progress: percentage of queue passed = (position-1) / total
  const passed   = Math.max(0, queuePosition - 1);
  const progress = totalInQueue > 0 ? Math.round((passed / totalInQueue) * 100) : 0;

  return (
    <div className="live-ticket-wrapper">
      <div className="live-ticket">

        {/* Top row */}
        <div className="live-ticket__top">
          <div>
            <h3 className="live-ticket__doctor-name">{doctorName}</h3>
            <p className="live-ticket__doctor-meta">{specialty} · {location}</p>
          </div>
          {isLive && (
            <div className="live-ticket__live-badge">
              <span className="live-ticket__live-dot" />
              Live
            </div>
          )}
        </div>

        {/* Queue circle */}
        <div className="live-ticket__queue-ring">
          <div className="live-ticket__queue-inner">
            <span className="live-ticket__queue-number">{queuePosition}</span>
          </div>
        </div>

        {/* Label */}
        <p className="live-ticket__position-label">Your position in queue</p>

        {/* Stats */}
        <div className="live-ticket__stats">
          <div className="live-ticket__stat">
            <div className="live-ticket__stat-value live-ticket__stat-value--gold">
              {estimatedWait}
            </div>
            <div className="live-ticket__stat-label">Est. wait</div>
          </div>
          <div className="live-ticket__stat">
            <div className="live-ticket__stat-value live-ticket__stat-value--navy">
              {fee} EGP
            </div>
            <div className="live-ticket__stat-label">Fee</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="live-ticket__progress-track">
          <div
            className="live-ticket__progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Cancel */}
        <button className="live-ticket__cancel-btn" type="button" onClick={onCancel}>
          Cancel My Booking
        </button>

      </div>
    </div>
  );
}

