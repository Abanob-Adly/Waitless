import { useRef, useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useApp } from "../../context/AppContext";

export function Navbar() {
  const { authUser, logout } = useAuth();
  const { clearBookings, bookings } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  function signOut() {
    logout();
    clearBookings();
    setDropdownOpen(false);
    navigate("/");
  }

  function isActive(path: string) {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  }

  const isDoctor = authUser?.role === "doctor";
  const isPatient = authUser?.role === "patient";
  const isAdmin = authUser?.role === "admin";
  const isReceptionist = authUser?.role === "receptionist";
  const patientProfile = isPatient ? authUser.profile : null;
  const doctorProfile = isDoctor ? authUser.profile : null;

  const birthdateLabel = patientProfile?.birthdate
    ? new Date(patientProfile.birthdate).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  const displayInitial = authUser
    ? authUser.profile.name.charAt(0).toUpperCase()
    : "?";
  const displayFirstName = authUser ? authUser.profile.name.split(" ")[0] : "";

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-navy">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <Link to="/" className="font-heading text-2xl font-bold text-white">
          Waitless
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 text-sm md:flex">
          <NavLink to="/" label="Home" active={isActive("/")} />

          {!isDoctor && (
            <NavLink
              to="/search"
              label="Find Doctors"
              active={isActive("/search") || isActive("/doctors")}
            />
          )}

          {isDoctor && (
            <NavLink
              to="/doctor-dashboard"
              label="Doctor Portal"
              active={isActive("/doctor-dashboard")}
            />
          )}

          {isAdmin && (
            <NavLink
              to="/admin"
              label="Admin Portal"
              active={isActive("/admin")}
            />
          )}

          {isReceptionist && (
            <NavLink
              to="/reception"
              label="Reception"
              active={isActive("/reception")}
            />
          )}

          {!authUser && (
            <NavLink to="/search" label="For Clinics" active={false} />
          )}

          {isPatient && (
            <NavLink
              to="/dashboard"
              label="My Bookings"
              active={isActive("/dashboard")}
            />
          )}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {authUser ? (
            <div ref={dropdownRef} className="relative">
              <button
                onClick={() => setDropdownOpen((o) => !o)}
                className="flex items-center gap-2 rounded-md border border-white/20 px-3 py-1.5 text-sm text-white/80 transition hover:border-white/40 hover:text-white"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold font-heading text-xs font-bold text-navy">
                  {displayInitial}
                </span>
                <span className="hidden sm:inline">{displayFirstName}</span>
                {isDoctor && (
                  <span className="hidden rounded-full bg-gold/20 px-1.5 py-0.5 text-[10px] font-medium text-gold sm:inline">
                    DR
                  </span>
                )}
                {isAdmin && (
                  <span className="hidden rounded-full bg-gold/20 px-1.5 py-0.5 text-[10px] font-medium text-gold sm:inline">
                    ADMIN
                  </span>
                )}
                {isReceptionist && (
                  <span className="hidden rounded-full bg-gold/20 px-1.5 py-0.5 text-[10px] font-medium text-gold sm:inline">
                    RECEP
                  </span>
                )}
                <span className="text-xs text-white/40">
                  {dropdownOpen ? "▲" : "▼"}
                </span>
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 animate-slide-down overflow-hidden rounded-lg border border-border bg-white shadow-xl">
                  <div className="border-b border-border px-4 py-3">
                    <p className="text-xs text-navy-mid">
                      Signed in as{" "}
                      <span className="font-medium text-navy">
                        {isDoctor
                          ? "Doctor"
                          : isAdmin
                            ? "Admin"
                            : isReceptionist
                              ? "Receptionist"
                              : "Patient"}
                      </span>
                    </p>
                    <p className="truncate text-sm font-semibold text-navy">
                      {authUser.profile.name}
                    </p>
                    <p className="text-xs text-navy-mid">
                      {authUser.profile.phone}
                    </p>
                    {birthdateLabel && (
                      <p className="mt-0.5 text-xs text-navy-mid">
                        DOB: {birthdateLabel}
                      </p>
                    )}
                    {isDoctor && doctorProfile && (
                      <p className="mt-0.5 text-xs text-navy-mid">
                        {doctorProfile.specialty}
                      </p>
                    )}
                  </div>

                  {isPatient && (
                    <>
                      <DropdownItem
                        label="My Dashboard"
                        onClick={() => {
                          navigate("/dashboard");
                          setDropdownOpen(false);
                        }}
                      />
                      <DropdownItem
                        label={`My Live Ticket${bookings.length > 0 ? ` (${bookings.length})` : ""}`}
                        onClick={() => {
                          navigate("/ticket");
                          setDropdownOpen(false);
                        }}
                        disabled={bookings.length === 0}
                      />
                    </>
                  )}

                  {isDoctor && (
                    <DropdownItem
                      label="Doctor Portal"
                      onClick={() => {
                        navigate("/doctor-dashboard");
                        setDropdownOpen(false);
                      }}
                    />
                  )}

                  {isAdmin && (
                    <DropdownItem
                      label="Admin Portal"
                      onClick={() => {
                        navigate("/admin");
                        setDropdownOpen(false);
                      }}
                    />
                  )}

                  {isReceptionist && (
                    <DropdownItem
                      label="Reception Portal"
                      onClick={() => {
                        navigate("/reception");
                        setDropdownOpen(false);
                      }}
                    />
                  )}

                  <div className="border-t border-border" />
                  <DropdownItem label="Sign Out" onClick={signOut} danger />
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => navigate("/login")}
              className="hidden text-sm text-white/80 transition hover:text-white sm:block"
            >
              Sign In
            </button>
          )}

          {!authUser && (
            <Link
              to="/signup"
              className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-navy transition hover:bg-gold-light"
            >
              Get Started
            </Link>
          )}

          {authUser && !isDoctor && !isAdmin && !isReceptionist && (
            <Link
              to="/search"
              className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-navy transition hover:bg-gold-light"
            >
              Find Doctor
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({ to, label, active }: { to: string; label: string; active: boolean }) {
  return (
    <Link
      to={to}
      className={
        active
          ? "font-medium text-gold"
          : "text-white/80 transition hover:text-gold-light"
      }
    >
      {label}
    </Link>
  );
}

function DropdownItem({
  label,
  onClick,
  danger = false,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full px-4 py-2.5 text-left text-sm transition hover:bg-offwhite disabled:cursor-not-allowed disabled:opacity-40 ${
        danger ? "text-danger" : "text-navy"
      }`}
    >
      {label}
    </button>
  );
}
