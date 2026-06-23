/**
 * App.jsx — Waitless UI Kit Demo
 *
 * This file demonstrates how to compose all components together.
 * In the real project, replace this with your router/page structure.
 */

import { useState } from 'react';
import './index.css';

// Layout
import Navbar from './components/layout/Navbar/Navbar';

// UI Atoms
import Button   from './components/ui/Button/Button';
import Badge    from './components/ui/Badge/Badge';
import Input    from './components/ui/Input/Input';
import DoctorCard from './components/ui/DoctorCard/DoctorCard';

// Sections
import SearchSection    from './components/sections/SearchSection/SearchSection';
import PaymentSection   from './components/sections/PaymentSection/PaymentSection';
import ClinicLocations  from './components/sections/ClinicLocations/ClinicLocations';
import LiveTicket       from './components/sections/LiveTicket/LiveTicket';
import QueueTable       from './components/sections/QueueTable/QueueTable';

// ── Sample Data ────────────────────────────────────────────────

const NAV_LINKS = [
  { label: 'Find Doctors', href: '#doctors' },
  { label: 'Specialties',  href: '#' },
  { label: 'For Clinics',  href: '#' },
  { label: 'My Bookings',  href: '#', active: true },
];

const DOCTORS = [
  {
    name: 'Dr. Layla Hassan', specialty: 'Consultant Cardiologist',
    rating: 4.9, reviewCount: 312, price: 350, location: 'Maadi +1',
    badges: [{ variant: 'cardiology', label: 'Cardiology' }, { variant: 'today', label: 'Today' }],
  },
  {
    name: 'Dr. Omar Farouk', specialty: 'Senior Dermatologist',
    rating: 4.8, reviewCount: 526, price: 250, location: 'Heliopolis',
    badges: [{ variant: 'dermatology', label: 'Dermatology' }, { variant: 'available', label: 'Available' }],
  },
  {
    name: 'Dr. Sara Mostafa', specialty: 'Pediatric Specialist',
    rating: 4.9, reviewCount: 891, price: 200, location: 'Nasr City',
    badges: [{ variant: 'pediatrics', label: 'Pediatrics' }, { variant: 'today', label: 'Today' }],
  },
  {
    name: 'Dr. Amr Khalil', specialty: 'Orthopedic Surgeon',
    rating: 4.7, reviewCount: 204, price: 400, location: 'Dokki',
    badges: [{ variant: 'orthopedics', label: 'Orthopedics' }, { variant: 'wait-days', label: '3d wait' }],
  },
];

const CLINICS = [
  { id: 'maadi',    name: 'Layla Hassan Heart Center',  address: '15 Road 9, Maadi, Cairo',      phone: '02-25168800' },
  { id: 'newcairo', name: 'New Cairo Medical Complex',  address: '3rd District, 5th Settlement', phone: '02-24188800' },
];

const BOOKING = {
  doctorName: 'Dr. Layla Hassan',
  specialty:  'Consultant Cardiologist',
  date:       'Mon, Mar 16',
  time:       '09:30 AM',
  clinic:     'Layla Hassan Heart Center',
  area:       'Maadi, Cairo',
  fee:        350,
};

const INITIAL_PATIENTS = [
  { id: 1, position: 1, name: 'Ahmed Youssef', joinedAt: '09:10', source: 'Walk-in', status: 'in-session' },
  { id: 2, position: 2, name: 'Nadia Karim',   joinedAt: '09:22', source: 'Online',  status: 'waiting'    },
  { id: 3, position: 3, name: 'Khaled Emad',   joinedAt: '09:35', source: 'Walk-in', status: 'no-show'    },
];

// ── App ─────────────────────────────────────────────────────────

export default function App() {
  const [patients, setPatients] = useState(INITIAL_PATIENTS);

  function handleMarkDone(id) {
    setPatients((prev) => prev.map((p) => p.id === id ? { ...p, status: 'done' } : p));
  }
  function handleMarkNoShow(id) {
    setPatients((prev) => prev.map((p) => p.id === id ? { ...p, status: 'no-show' } : p));
  }
  function handleRestore(id) {
    setPatients((prev) => prev.map((p) => p.id === id ? { ...p, status: 'waiting' } : p));
  }

  return (
    <>
      {/* ── Navigation ── */}
      <Navbar links={NAV_LINKS} />

      {/* ── Search ── */}
      <SearchSection onSearch={(v) => console.log('Search:', v)} />

      {/* ── Doctor Cards ── */}
      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '56px 24px', display: 'flex', flexDirection: 'column', gap: 80 }}>

        <section id="doctors">
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, fontWeight: 700, marginBottom: 24 }}>
            Top Specialists
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 20 }}>
            {DOCTORS.map((doc) => (
              <DoctorCard key={doc.name} {...doc} onClick={() => console.log('Clicked:', doc.name)} />
            ))}
          </div>
        </section>

        {/* ── Clinic Locations (standalone card) ── */}
        <ClinicLocations clinics={CLINICS} activeId="maadi" />

        {/* ── Live Ticket ── */}
        <section>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
            Live Digital Ticket
          </h2>
          <p style={{ color: '#9CA3AF', fontSize: 14, marginBottom: 32 }}>
            Abanob's module · Real-time queue position
          </p>
          <LiveTicket
            doctorName="Dr. Layla Hassan"
            specialty="Cardiology"
            location="Maadi"
            queuePosition={3}
            totalInQueue={8}
            estimatedWait="~36m"
            fee={350}
            onCancel={() => alert('Booking cancelled')}
          />
        </section>

        {/* ── Queue Table ── */}
        <section>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
            Receptionist Dashboard
          </h2>
          <p style={{ color: '#9CA3AF', fontSize: 14, marginBottom: 32 }}>
            Mohamed Eid's module · Status badges · Action buttons inline
          </p>
          <QueueTable
            patients={patients}
            onCallNext={() => console.log('Calling next patient')}
            onMarkDone={handleMarkDone}
            onMarkNoShow={handleMarkNoShow}
            onRestore={handleRestore}
          />
        </section>

      </main>

      {/* ── Payment Section ── */}
      <PaymentSection
        booking={BOOKING}
        onPay={(data) => console.log('Payment submitted:', data)}
      />

    </>
  );
}
