// ── Brand detection (exported for use in PaymentPage) ────────────────────────

export type CardBrand = "visa" | "mastercard" | "amex" | "unknown";

export function detectCardBrand(digits: string): CardBrand {
  const d = digits.replace(/\s/g, "");
  if (/^4/.test(d)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(d)) return "mastercard";
  if (/^3[47]/.test(d)) return "amex";
  return "unknown";
}

// ── Component ─────────────────────────────────────────────────────────────────

type CardVisualProps = {
  cardNumber: string;
  cardholderName: string;
  expiry: string;
  showBack: boolean;
  brand: CardBrand;
};

export function CardVisual({
  cardNumber,
  cardholderName,
  expiry,
  showBack,
  brand,
}: CardVisualProps) {
  // Build display number: show last 4, mask the rest
  const raw = cardNumber.replace(/\s/g, "");
  const last4 = raw.slice(-4).padEnd(4, "X");
  const displayNumber = `•••• •••• •••• ${last4}`;

  const displayName = cardholderName.trim() || "YOUR NAME";
  const displayExpiry = expiry || "MM / YY";

  return (
    // Outer container — sets 3D perspective
    <div
      style={{ perspective: "1000px" }}
      className="h-[214px] w-[340px] select-none"
    >
      {/* Flipper — rotates on Y axis */}
      <div
        style={{
          transition: "transform 0.6s ease",
          transformStyle: "preserve-3d",
          transform: showBack ? "rotateY(180deg)" : "rotateY(0deg)",
          position: "relative",
          width: "100%",
          height: "100%",
        }}
      >
        {/* ── FRONT FACE ── */}
        <div
          style={{ backfaceVisibility: "hidden" }}
          className="absolute inset-0 overflow-hidden rounded-2xl bg-navy shadow-2xl"
        >
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-navy-mid/60 to-transparent" />

          {/* Decorative circles */}
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold/5" />
          <div className="absolute -bottom-12 -left-8 h-48 w-48 rounded-full bg-gold/5" />

          <div className="relative flex h-full flex-col justify-between p-6">
            {/* Top row: chip + brand */}
            <div className="flex items-center justify-between">
              {/* EMV Chip SVG */}
              <svg width="44" height="34" viewBox="0 0 44 34">
                <rect
                  x="1"
                  y="1"
                  width="42"
                  height="32"
                  rx="4"
                  fill="#C9922A"
                  stroke="#E8B84B"
                  strokeWidth="1"
                />
                <line
                  x1="15"
                  y1="1"
                  x2="15"
                  y2="33"
                  stroke="#0A1628"
                  strokeWidth="1"
                />
                <line
                  x1="29"
                  y1="1"
                  x2="29"
                  y2="33"
                  stroke="#0A1628"
                  strokeWidth="1"
                />
                <line
                  x1="1"
                  y1="12"
                  x2="43"
                  y2="12"
                  stroke="#0A1628"
                  strokeWidth="1"
                />
                <line
                  x1="1"
                  y1="22"
                  x2="43"
                  y2="22"
                  stroke="#0A1628"
                  strokeWidth="1"
                />
              </svg>

              {/* Brand mark */}
              <BrandMark brand={brand} />
            </div>

            {/* Card number */}
            <p
              className="font-mono text-xl tracking-widest text-white/90"
              style={{ letterSpacing: "0.12em" }}
            >
              {displayNumber}
            </p>

            {/* Bottom row: name + expiry */}
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[9px] uppercase tracking-widest text-white/40">
                  Card Holder
                </p>
                <p className="mt-0.5 truncate text-sm font-medium uppercase tracking-wider text-white/90">
                  {displayName}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] uppercase tracking-widest text-white/40">
                  Expires
                </p>
                <p className="mt-0.5 font-mono text-sm text-white/90">
                  {displayExpiry}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── BACK FACE ── */}
        <div
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
          className="absolute inset-0 overflow-hidden rounded-2xl bg-navy shadow-2xl"
        >
          {/* Magnetic stripe */}
          <div className="mt-8 h-10 w-full bg-black/70" />

          {/* Signature strip + CVV */}
          <div className="mt-5 flex items-center px-6">
            <div className="h-8 flex-1 rounded-sm bg-white/90" />
            <div className="ml-3 flex h-8 min-w-[52px] items-center justify-center rounded-sm bg-white px-2">
              <p className="font-mono text-sm font-bold tracking-widest text-navy">
                •••
              </p>
            </div>
          </div>

          {/* CVV label */}
          <p className="mt-1 pr-6 text-right text-[9px] uppercase tracking-widest text-white/40">
            CVV
          </p>

          {/* Bottom branding */}
          <div className="absolute bottom-4 left-0 right-0 flex items-center justify-between px-6">
            <p className="text-[9px] text-white/30">waitless.health</p>
            <BrandMark brand={brand} small />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Brand mark ────────────────────────────────────────────────────────────────

function BrandMark({
  brand,
  small = false,
}: {
  brand: CardBrand;
  small?: boolean;
}) {
  if (brand === "visa") {
    return (
      <span
        className={`font-heading font-extrabold italic text-white ${small ? "text-lg" : "text-2xl"}`}
        style={{ letterSpacing: "-0.02em" }}
      >
        VISA
      </span>
    );
  }
  if (brand === "mastercard") {
    return (
      <div className="flex items-center gap-0.5">
        <div
          className={`rounded-full bg-[#EB001B] ${small ? "h-5 w-5" : "h-7 w-7"}`}
        />
        <div
          className={`-ml-2 rounded-full bg-[#F79E1B] opacity-90 ${small ? "h-5 w-5" : "h-7 w-7"}`}
        />
      </div>
    );
  }
  if (brand === "amex") {
    return (
      <span
        className={`font-heading font-bold text-gold ${small ? "text-xs" : "text-sm"}`}
      >
        AMEX
      </span>
    );
  }
  return (
    <span
      className={`font-heading font-medium text-white/30 ${small ? "text-xs" : "text-sm"}`}
    >
      CARD
    </span>
  );
}
