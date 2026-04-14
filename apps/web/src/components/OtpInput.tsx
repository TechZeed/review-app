import { useState, useRef, useEffect } from "react";

interface OtpInputProps {
  onVerified: (token: string) => void;
  onClose: () => void;
  reviewToken: string;
}

const API_URL = import.meta.env.VITE_API_URL || "";

export default function OtpInput({ onVerified, onClose, reviewToken }: OtpInputProps) {
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [otpId, setOtpId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const isDev = import.meta.env.DEV;

  useEffect(() => {
    if (resendCooldown > 0) {
      const t = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendCooldown]);

  const sendOtp = async () => {
    if (!phone || phone.length < 7) {
      setError("Enter a valid phone number");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/v1/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, countryCode: "+1" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to send OTP");
      setOtpId(data.otpId);
      setStep("otp");
      setResendCooldown(30);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (code: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/v1/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otpId, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Invalid code");
      onVerified(data.token || reviewToken);
    } catch (e: any) {
      setError(e.message);
      setDigits(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleDigitChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...digits];
    next[index] = value.slice(-1);
    setDigits(next);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit on last digit
    if (value && index === 5) {
      const code = next.join("");
      if (code.length === 6) verifyOtp(code);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const skipOtp = () => {
    onVerified(reviewToken);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-gray-900">Verify Your Review</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {step === "phone" ? (
          <div className="space-y-4">
            <label className="block text-sm text-gray-600">Phone number</label>
            <div className="flex gap-2">
              <span className="flex items-center px-3 bg-gray-100 rounded-lg text-sm text-gray-600 border border-gray-200">
                +1
              </span>
              <input
                type="tel"
                inputMode="tel"
                aria-label="Phone number"
                autoFocus
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && sendOtp()}
                placeholder="Phone number"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={sendOtp}
              disabled={loading || !phone}
              className="w-full py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:bg-gray-300 disabled:text-gray-500 transition-colors"
            >
              {loading ? "Sending..." : "Send Code"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 text-center">
              Enter the 6-digit code sent to your phone
            </p>
            <div className="flex justify-center gap-2">
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  autoComplete={i === 0 ? "one-time-code" : "off"}
                  aria-label={`Digit ${i + 1} of 6`}
                  maxLength={1}
                  value={d}
                  autoFocus={i === 0}
                  onChange={(e) => handleDigitChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className="w-10 h-12 text-center text-xl font-bold border-2 border-gray-300 rounded-lg focus:outline-none focus:border-primary-600 focus:ring-1 focus:ring-primary-600"
                />
              ))}
            </div>
            <div className="text-center">
              <button
                onClick={() => { setResendCooldown(30); sendOtp(); }}
                disabled={resendCooldown > 0}
                className="text-sm text-primary-600 hover:text-primary-800 disabled:text-gray-400"
              >
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
              </button>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600 text-center">{error}</p>
        )}

        <p className="mt-4 text-xs text-gray-400 text-center">
          Your number is used only to verify this review. We never share it.
        </p>

        {isDev && (
          <button
            onClick={skipOtp}
            className="mt-3 w-full py-2 text-sm text-orange-600 border border-orange-300 rounded-lg hover:bg-orange-50 transition-colors"
          >
            Skip OTP (dev mode)
          </button>
        )}
      </div>
    </div>
  );
}
