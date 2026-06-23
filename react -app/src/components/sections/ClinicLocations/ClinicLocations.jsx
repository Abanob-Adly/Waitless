import { useState } from 'react';
import './ClinicLocations.css';

/**
 * ClinicLocations — Waitless UI Kit
 *
 * @prop {string} title   - card heading (default "Clinic Locations")
 * @prop {Array}  clinics - array of { id, name, address, phone }
 * @prop {string} activeId        - id of the currently active clinic
 * @prop {function} onSelect      - called with clinic id when a row is clicked
 *
 * @example
 * <ClinicLocations
 *   clinics={[
 *     { id: 'maadi',     name: 'Layla Hassan Heart Center', address: '15 Road 9, Maadi, Cairo',          phone: '02-25168800' },
 *     { id: 'newcairo',  name: 'New Cairo Medical Complex', address: '3rd District, 5th Settlement',     phone: '02-24188800' },
 *   ]}
 *   activeId="maadi"
 *   onSelect={(id) => setActiveClinic(id)}
 * />
 */

const PinIcon = ({ active }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path
      d="M12 22C12 22 19 15.5 19 10C19 6.13401 15.866 3 12 3C8.13401 3 5 6.13401 5 10C5 15.5 12 22 12 22Z"
      stroke={active ? 'white' : '#B0AECB'}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    />
    <circle cx="12" cy="10" r="2.5" stroke={active ? 'white' : '#B0AECB'} strokeWidth="1.8"/>
  </svg>
);

const PhoneIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
    <path
      d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.18 21 3 13.82 3 5a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.25 1.01l-2.2 2.2z"
      fill="currentColor"
    />
  </svg>
);

export default function ClinicLocations({
  title   = 'Clinic Locations',
  clinics = [],
  activeId,
  onSelect,
}) {
  const [selected, setSelected] = useState(activeId ?? clinics[0]?.id);

  function handleSelect(id) {
    setSelected(id);
    onSelect?.(id);
  }

  return (
    <section className="clinic-locations-section">
      <div className="clinic-card">
        <p className="clinic-card__title">{title}</p>

        <ul className="clinic-list">
          {clinics.map((clinic) => {
            const isActive = selected === clinic.id;
            return (
              <li
                key={clinic.id}
                className={`clinic-row${isActive ? ' clinic-row--active' : ''}`}
                onClick={() => handleSelect(clinic.id)}
              >
                <div className={`clinic-row__icon${isActive ? ' clinic-row__icon--active' : ''}`}>
                  <PinIcon active={isActive} />
                </div>

                <div className="clinic-row__info">
                  <span className="clinic-row__name">{clinic.name}</span>
                  <div className="clinic-row__meta">
                    <span className="clinic-row__address">{clinic.address}</span>
                    {clinic.phone && (
                      <>
                        <span className="clinic-row__divider">—</span>
                        <PhoneIcon />
                        <span className="clinic-row__phone">{clinic.phone}</span>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
