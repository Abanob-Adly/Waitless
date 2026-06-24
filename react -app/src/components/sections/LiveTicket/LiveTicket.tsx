import './LiveTicket.css';

interface LiveTicketProps {
  doctorName?:    string;
  specialty?:     string;
  location?:      string;
  queuePosition?: number;
  totalInQueue?:  number;
  estimatedWait?: string;
  fee?:           number;
  isLive?:        boolean;
  onCancel?:      () => void;
}

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
}: LiveTicketProps) {
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