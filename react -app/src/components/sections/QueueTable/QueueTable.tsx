import './QueueTable.css';
import Badge from '../../ui/Badge/Badge';

type PatientStatus = 'in-session' | 'waiting' | 'no-show' | 'done';

interface Patient {
  id:       string | number;
  position: number;
  name:     string;
  joinedAt: string;
  source:   string;
  status:   PatientStatus;
}

interface BadgeConfig {
  variant: string;
  label:   string;
}

interface QueueTableProps {
  title?:        string;
  patients?:     Patient[];
  onCallNext?:   () => void;
  onMarkDone?:   (id: string | number) => void;
  onMarkNoShow?: (id: string | number) => void;
  onRestore?:    (id: string | number) => void;
}

const PhoneIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
    />
  </svg>
);

const STATUS_BADGE_MAP: Record<PatientStatus, BadgeConfig> = {
  'in-session': { variant: 'in-session', label: 'In Session' },
  'waiting':    { variant: 'waiting',    label: 'Waiting'    },
  'no-show':    { variant: 'no-show',    label: '✕ No Show'  },
  'done':       { variant: 'completed',  label: '✓ Done'     },
};

const NUMBER_CLASS_MAP: Record<PatientStatus, string> = {
  'in-session': 'queue-table__number--in-session',
  'waiting':    'queue-table__number--waiting',
  'no-show':    'queue-table__number--no-show',
  'done':       'queue-table__number--default',
};

const ROW_CLASS_MAP: Partial<Record<PatientStatus, string>> = {
  'in-session': 'queue-table__row--in-session',
  'no-show':    'queue-table__row--no-show',
};

export default function QueueTable({
  title      = "Today's Queue",
  patients   = [],
  onCallNext,
  onMarkDone,
  onMarkNoShow,
  onRestore,
}: QueueTableProps) {
  const waiting = patients.filter((p) => p.status === 'waiting').length;
  const done    = patients.filter((p) => p.status === 'done').length;
  const noShows = patients.filter((p) => p.status === 'no-show').length;

  return (
    <div className="queue-table">

      {/* Header */}
      <div className="queue-table__header">
        <div className="queue-table__header-info">
          <h3>{title}</h3>
          <p>{waiting} waiting · {done} done · {noShows} no-shows</p>
        </div>
        <button className="queue-table__call-btn" type="button" onClick={onCallNext}>
          <PhoneIcon />
          Call Next
        </button>
      </div>

      {/* Column headers */}
      <div className="queue-table__col-headers">
        <div className="queue-table__col-label">#</div>
        <div className="queue-table__col-label">Patient</div>
        <div className="queue-table__col-label">Status</div>
        <div className="queue-table__col-label">Action</div>
      </div>

      {/* Rows */}
      {patients.map((patient) => {
        const rowClass    = ROW_CLASS_MAP[patient.status]    ?? '';
        const numClass    = NUMBER_CLASS_MAP[patient.status] ?? 'queue-table__number--default';
        const badgeConfig = STATUS_BADGE_MAP[patient.status] ?? { variant: 'neutral', label: patient.status };

        return (
          <div key={patient.id} className={`queue-table__row ${rowClass}`}>

            {/* Number */}
            <div>
              <div className={`queue-table__number ${numClass}`}>
                {patient.position}
              </div>
            </div>

            {/* Patient info */}
            <div>
              <p className="queue-table__patient-name">{patient.name}</p>
              <p className="queue-table__patient-meta">
                Joined {patient.joinedAt} · {patient.source}
              </p>
            </div>

            {/* Status badge */}
            <div className="queue-table__status">
              <Badge variant={badgeConfig.variant as any}>{badgeConfig.label}</Badge>
            </div>

            {/* Action button */}
            <div className="queue-table__action">
              {patient.status === 'in-session' && (
                <button className="queue-table__action-btn queue-table__action-btn--done"
                  onClick={() => onMarkDone?.(patient.id)}>
                  Done ✓
                </button>
              )}
              {patient.status === 'waiting' && (
                <button className="queue-table__action-btn queue-table__action-btn--no-show"
                  onClick={() => onMarkNoShow?.(patient.id)}>
                  No Show
                </button>
              )}
              {patient.status === 'no-show' && (
                <button className="queue-table__action-btn queue-table__action-btn--restore"
                  onClick={() => onRestore?.(patient.id)}>
                  Restore
                </button>
              )}
            </div>

          </div>
        );
      })}
    </div>
  );
}