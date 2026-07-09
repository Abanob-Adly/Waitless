import { useRef, useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useApp } from "../../context/AppContext";
import { useLanguage } from "../../context/LanguageContext";
import * as patientService from "../../services/patientService";

export function Navbar() {
  const { authUser, logout } = useAuth();
  const { bookings } = useApp();
  const { locale, toggleLocale, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [navAvatarUrl, setNavAvatarUrl] = useState(() => localStorage.getItem("waitless_avatar_url") ?? "");

  // Fetch / update avatar when auth user changes
  const userId = authUser ? (authUser.profile as { id?: string }).id ?? "" : "";
  useEffect(() => {
    if (!userId) { setNavAvatarUrl(""); return; }
    if (authUser?.role === "patient") {
      patientService.getOwnProfile().then((p) => setNavAvatarUrl(p?.avatarUrl ?? ""));
    } else {
      setNavAvatarUrl(localStorage.getItem("waitless_avatar_url") ?? "");
    }
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for doctor avatar updates dispatched by DoctorDashboard
  useEffect(() => {
    function handleAvatarUpdate(e: Event) {
      setNavAvatarUrl((e as CustomEvent<{ url: string }>).detail.url);
    }
    window.addEventListener("waitless:avatarUpdated", handleAvatarUpdate);
    return () => window.removeEventListener("waitless:avatarUpdated", handleAvatarUpdate);
  }, []);

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

  // Close the mobile nav panel whenever the route changes — otherwise it
  // stays open over the newly-navigated page.
  useEffect(() => { setMobileMenuOpen(false); }, [location.pathname]);

  function signOut() {
    logout();
    setDropdownOpen(false);
    setMobileMenuOpen(false);
    localStorage.removeItem("waitless_avatar_url");
    setNavAvatarUrl("");
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
          <NavLink to="/" label={t("Home")} active={isActive("/")} />

          {isPatient && (
            <NavLink
              to="/search"
              label={t("Find Doctors")}
              active={isActive("/search") || isActive("/doctors")}
            />
          )}

          {isDoctor && (
            <NavLink
              to="/doctor-dashboard"
              label={t("Doctor Portal")}
              active={isActive("/doctor-dashboard")}
            />
          )}

          {isAdmin && (
            <NavLink
              to="/admin"
              label={t("Admin Portal")}
              active={isActive("/admin")}
            />
          )}

          {isReceptionist && (
            <NavLink
              to="/reception"
              label={t("Reception")}
              active={isActive("/reception")}
            />
          )}

          {!authUser && (
            <NavLink to="/for-clinics" label={t("For Clinics")} active={isActive("/for-clinics")} />
          )}

          {isPatient && (
            <NavLink
              to="/dashboard"
              label={t("My Bookings")}
              active={isActive("/dashboard")}
            />
          )}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Language toggle */}
          <button
            onClick={toggleLocale}
            className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:border-white/40 hover:text-white"
          >
            {locale === "en" ? "عربي" : "English"}
          </button>
          {authUser ? (
            <div ref={dropdownRef} className="relative">
              <button
                onClick={() => setDropdownOpen((o) => !o)}
                className="flex items-center gap-2 rounded-md border border-white/20 px-3 py-1.5 text-sm text-white/80 transition hover:border-white/40 hover:text-white"
              >
                {navAvatarUrl ? (
                  <img
                    src={navAvatarUrl}
                    alt={displayFirstName}
                    className="h-6 w-6 rounded-full object-cover"
                    onError={() => setNavAvatarUrl("")}
                  />
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold font-heading text-xs font-bold text-navy">
                    {displayInitial}
                  </span>
                )}
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
                      {t("Signed in as")}{" "}
                      <span className="font-medium text-navy">
                        {isDoctor
                          ? t("Doctor")
                          : isAdmin
                            ? t("Admin")
                            : isReceptionist
                              ? t("Receptionist")
                              : t("Patient")}
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
                        {t("DOB:")} {birthdateLabel}
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
                        label={t("My Dashboard")}
                        onClick={() => {
                          navigate("/dashboard");
                          setDropdownOpen(false);
                        }}
                      />
                      <DropdownItem
                        label={t("My Live Ticket") + (bookings.length > 0 ? ` (${bookings.length})` : "")}
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
                      label={t("Doctor Portal")}
                      onClick={() => {
                        navigate("/doctor-dashboard");
                        setDropdownOpen(false);
                      }}
                    />
                  )}

                  {isAdmin && (
                    <DropdownItem
                      label={t("Admin Portal")}
                      onClick={() => {
                        navigate("/admin");
                        setDropdownOpen(false);
                      }}
                    />
                  )}

                  {isReceptionist && (
                    <DropdownItem
                      label={t("Reception Portal")}
                      onClick={() => {
                        navigate("/reception");
                        setDropdownOpen(false);
                      }}
                    />
                  )}

                  <div className="border-t border-border" />
                  <DropdownItem label={t("Sign Out")} onClick={signOut} danger />
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => navigate("/login")}
              className="hidden text-sm text-white/80 transition hover:text-white sm:block"
            >
              {t("Sign In")}
            </button>
          )}

          {!authUser && (
            <Link
              to="/signup"
              className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-navy transition hover:bg-gold-light"
            >
              {t("Get Started")}
            </Link>
          )}

          {authUser && !isDoctor && !isAdmin && !isReceptionist && (
            <Link
              to="/search"
              className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-navy transition hover:bg-gold-light"
            >
              {t("Find Doctor")}
            </Link>
          )}

          {/* Mobile menu toggle — the <nav> above is hidden below md, and
              "Sign In" is hidden below sm, so without this a mobile visitor
              had no way to reach Home/Find Doctors/portal links, and a
              logged-out visitor had no way to sign in at all. */}
          <button
            onClick={() => setMobileMenuOpen((o) => !o)}
            aria-label={t("Menu")}
            aria-expanded={mobileMenuOpen}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-white/20 text-white/80 transition hover:border-white/40 hover:text-white md:hidden"
          >
            {mobileMenuOpen ? (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M2 2l14 14M16 2L2 16" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M1 4h16M1 9h16M1 14h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile nav panel */}
      {mobileMenuOpen && (
        <div className="border-t border-white/10 bg-navy px-4 pb-4 pt-2 md:hidden">
          <nav className="flex flex-col gap-1 text-sm">
            <MobileNavLink to="/" label={t("Home")} active={isActive("/")} />
            {isPatient && (
              <MobileNavLink to="/search" label={t("Find Doctors")} active={isActive("/search") || isActive("/doctors")} />
            )}
            {isDoctor && (
              <MobileNavLink to="/doctor-dashboard" label={t("Doctor Portal")} active={isActive("/doctor-dashboard")} />
            )}
            {isAdmin && (
              <MobileNavLink to="/admin" label={t("Admin Portal")} active={isActive("/admin")} />
            )}
            {isReceptionist && (
              <MobileNavLink to="/reception" label={t("Reception")} active={isActive("/reception")} />
            )}
            {!authUser && (
              <MobileNavLink to="/for-clinics" label={t("For Clinics")} active={isActive("/for-clinics")} />
            )}
            {isPatient && (
              <MobileNavLink to="/dashboard" label={t("My Bookings")} active={isActive("/dashboard")} />
            )}
            {!authUser && (
              <MobileNavLink to="/login" label={t("Sign In")} active={isActive("/login")} />
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

function MobileNavLink({ to, label, active }: { to: string; label: string; active: boolean }) {
  return (
    <Link
      to={to}
      className={`rounded-md px-3 py-2.5 ${
        active ? "bg-white/10 font-medium text-gold" : "text-white/80 transition hover:bg-white/5 hover:text-white"
      }`}
    >
      {label}
    </Link>
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
