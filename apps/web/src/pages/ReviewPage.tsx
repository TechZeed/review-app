import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import Avatar from "../components/Avatar";
import QualityChip from "../components/QualityChip";
import ThumbsUpButton from "../components/ThumbsUpButton";
import OtpInput from "../components/OtpInput";
import MediaPrompt from "../components/MediaPrompt";
import ThankYou from "../components/ThankYou";

const API_URL = import.meta.env.VITE_API_URL || "";

interface ProfileData {
  id: string;
  name: string;
  headline: string | null;
  photoUrl: string | null;
  orgName: string | null;
  role: string | null;
  totalReviews: number;
  slug: string;
}

const QUALITIES = [
  { key: "expertise", name: "Expertise", icon: "🎯" },
  { key: "care", name: "Care", icon: "💛" },
  { key: "delivery", name: "Delivery", icon: "🚀" },
  { key: "initiative", name: "Initiative", icon: "💡" },
  { key: "trust", name: "Trust", icon: "🤝" },
];

// Simple fingerprint from available browser data
async function getDeviceFingerprint(): Promise<string> {
  const parts = [
    navigator.userAgent,
    navigator.language,
    screen.width + "x" + screen.height,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ];
  const str = parts.join("|");
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(str),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Shuffle array with a seed (session-based randomization)
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed;
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 16807 + 0) % 2147483647;
    const j = s % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

type Step = "landing" | "otp" | "media" | "thankyou";

export default function ReviewPage() {
  const { slug } = useParams<{ slug: string }>();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedQualities, setSelectedQualities] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [step, setStep] = useState<Step>("landing");
  const [reviewToken, setReviewToken] = useState("");
  const [reviewId, setReviewId] = useState("");

  // Session seed for quality randomization
  const sessionSeed = useMemo(() => Date.now(), []);
  const shuffledQualities = useMemo(() => seededShuffle(QUALITIES, sessionSeed), [sessionSeed]);

  // Load profile
  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/profiles/${slug}`);
        if (!res.ok) throw new Error("Profile not found");
        const data = await res.json();
        // API may return snake_case or camelCase; normalize
        setProfile({
          id: data.id,
          name: data.name || data.displayName || "Unknown",
          headline: data.headline ?? null,
          photoUrl: data.photoUrl || data.photo_url || null,
          orgName: data.orgName || data.org_name || data.currentOrg || null,
          role: data.role || data.currentRole || null,
          totalReviews: data.totalReviews ?? data.total_reviews ?? 0,
          slug: data.slug || slug,
        });
      } catch (e: any) {
        setError(e.message || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const toggleQuality = (key: string): boolean => {
    if (selectedQualities.includes(key)) {
      setSelectedQualities(selectedQualities.filter((q) => q !== key));
      return true;
    }
    if (selectedQualities.length >= 2) {
      return false; // rejected — trigger shake
    }
    setSelectedQualities([...selectedQualities, key]);
    return true;
  };

  const handleSubmit = async () => {
    if (!profile || selectedQualities.length === 0) return;
    setIsSubmitting(true);

    try {
      // Step 1: Initiate scan
      const scanRes = await fetch(`${API_URL}/api/v1/reviews/scan/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceFingerprint: await getDeviceFingerprint() }),
      });
      const scanData = await scanRes.json();
      if (!scanRes.ok) throw new Error(scanData.message || "Failed to start review");
      setReviewToken(scanData.reviewToken || scanData.review_token || "");
      setIsSubmitted(true);

      // Show checkmark animation, then move to OTP
      setTimeout(() => setStep("otp"), 600);
    } catch (e: any) {
      setError(e.message);
      setIsSubmitting(false);
    }
  };

  const handleOtpVerified = async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/reviews/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewToken: token || reviewToken,
          qualities: selectedQualities,
          qualityDisplayOrder: shuffledQualities.map((q) => q.key),
          thumbsUp: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Submit failed");
      setReviewId(data.reviewId || data.review_id || data.id || "");
      setStep("media");
    } catch (e: any) {
      setError(e.message);
      setStep("landing");
      setIsSubmitted(false);
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  // Error state
  if (error && !profile) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center space-y-4">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
          <span className="text-3xl">😕</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900">Profile not found</h1>
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    );
  }

  if (!profile) return null;

  // Thank you step
  if (step === "thankyou") {
    return <ThankYou name={profile.name} />;
  }

  // Media prompt step
  if (step === "media") {
    return <MediaPrompt reviewId={reviewId} onDone={() => setStep("thankyou")} />;
  }

  // OTP step (modal overlay on landing)
  // Landing page is always rendered underneath
  return (
    <div className="flex flex-col h-full bg-gray-50 relative">
      {/* Profile Header — spec 25: large identity-confirmation avatar
          above the quality chips so the customer recognises the face
          before they tap. */}
      <div className="flex flex-col items-center gap-2 px-5 pt-6 pb-3 text-center">
        <Avatar name={profile.name} photoUrl={profile.photoUrl} size="xl" />
        <h1 className="text-xl font-bold text-gray-900 truncate max-w-full">
          {profile.name}
        </h1>
        {(profile.headline || profile.role || profile.orgName) && (
          <p className="text-sm text-gray-500 truncate max-w-full">
            {profile.headline ||
              [profile.role, profile.orgName].filter(Boolean).join(" at ")}
          </p>
        )}
      </div>

      {/* Review Count Badge */}
      {profile.totalReviews > 0 && (
        <div className="px-5 pb-2">
          <span className="inline-block px-3 py-1 bg-primary-50 text-primary-700 text-xs font-medium rounded-full">
            {profile.totalReviews} review{profile.totalReviews !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Quality Selection */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 space-y-5">
        <p className="text-base text-gray-600 text-center">
          Tap the qualities that stood out
        </p>

        {/* Accessibility announcement */}
        <div className="sr-only" aria-live="polite">
          {selectedQualities.length} of 5 qualities selected
        </div>

        {/* 3-2 Grid */}
        <div className="space-y-3">
          <div className="flex justify-center gap-2.5">
            {shuffledQualities.slice(0, 3).map((q) => (
              <QualityChip
                key={q.key}
                name={q.name}
                icon={q.icon}
                selected={selectedQualities.includes(q.key)}
                onToggle={() => toggleQuality(q.key)}
              />
            ))}
          </div>
          <div className="flex justify-center gap-2.5">
            {shuffledQualities.slice(3, 5).map((q) => (
              <QualityChip
                key={q.key}
                name={q.name}
                icon={q.icon}
                selected={selectedQualities.includes(q.key)}
                onToggle={() => toggleQuality(q.key)}
              />
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-2 w-full">
          <ThumbsUpButton
            disabled={selectedQualities.length === 0}
            loading={isSubmitting && !isSubmitted}
            submitted={isSubmitted}
            onClick={handleSubmit}
          />
        </div>

        {/* Error message */}
        {error && (
          <p role="alert" className="text-sm text-red-600 text-center">{error}</p>
        )}
      </div>

      {/* OTP Modal */}
      {step === "otp" && (
        <OtpInput
          reviewToken={reviewToken}
          onVerified={handleOtpVerified}
          onClose={() => {
            setStep("landing");
            setIsSubmitted(false);
            setIsSubmitting(false);
          }}
        />
      )}
    </div>
  );
}
