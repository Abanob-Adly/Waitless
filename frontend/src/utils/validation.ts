type ValidationResult = { valid: boolean; error: string };

export function validatePhone(phone: string): ValidationResult {
  const cleaned = phone.replace(/\s/g, "");
  if (/^01[0125]\d{8}$/.test(cleaned)) return { valid: true, error: "" };
  return {
    valid: false,
    error: "Please enter a valid Egyptian mobile number (e.g. 01XXXXXXXXX).",
  };
}

export function validateCardNumber(rawDigits: string): ValidationResult {
  const digits = rawDigits.replace(/\s/g, "");
  if (!/^\d{16}$/.test(digits)) {
    return { valid: false, error: "Card number must be 16 digits." };
  }
  // Luhn mod-10 check
  let sum = 0;
  for (let i = 0; i < 16; i++) {
    let d = parseInt(digits[15 - i], 10);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  if (sum % 10 !== 0) {
    return { valid: false, error: "Please enter a valid card number." };
  }
  return { valid: true, error: "" };
}

export function validateExpiry(expiry: string): ValidationResult {
  const digits = expiry.replace(/\D/g, "");
  if (digits.length < 4) {
    return { valid: false, error: "Please enter expiry date." };
  }
  const month = parseInt(digits.slice(0, 2), 10);
  const year = parseInt(digits.slice(2, 4), 10) + 2000;
  if (month < 1 || month > 12) {
    return { valid: false, error: "Please enter a valid expiry month." };
  }
  const expiryDate = new Date(year, month, 0);
  if (expiryDate < new Date()) {
    return { valid: false, error: "Card has expired." };
  }
  return { valid: true, error: "" };
}

export function validateCVV(cvv: string): ValidationResult {
  if (/^\d{3,4}$/.test(cvv)) return { valid: true, error: "" };
  return { valid: false, error: "Please enter a valid CVV (3–4 digits)." };
}

export function validateBirthdate(date: string): ValidationResult {
  if (!date) return { valid: false, error: "Birthdate is required." };
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) {
    return { valid: false, error: "Please enter a valid date." };
  }
  const today = new Date();
  if (parsed >= today) {
    return { valid: false, error: "Birthdate cannot be in the future." };
  }
  // Must be at least 1 year old
  const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
  if (parsed > oneYearAgo) {
    return { valid: false, error: "Patient must be at least 1 year old." };
  }
  return { valid: true, error: "" };
}

export function validatePassword(password: string): ValidationResult {
  if (password.length < 8 || !/\d/.test(password)) {
    return {
      valid: false,
      error: "Password must be at least 8 characters and contain a number.",
    };
  }
  return { valid: true, error: "" };
}
