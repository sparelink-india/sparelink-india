"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { validateGSTIN } from "@/lib/gst";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth-policy";
import {
  buildEmailPasswordRegistrationPayload,
  hasRegistrationErrors,
  validateEmailPasswordRegistration,
  type EmailPasswordRegistrationErrorCode,
  type EmailPasswordRegistrationErrors,
  type ShippingPreference,
} from "@/lib/register-form";
import { AuthShell } from "@/components/auth-shell";
import { StorefrontHeader } from "@/components/storefront-header";
import { SiteFooter } from "@/components/site-footer";
import { useI18n } from "@/components/preferences-provider";

type RegisterMode = "email" | "otp";

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useI18n();

  // Registration Form State
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [gstin, setGstin] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [state] = useState("");
  const [pincode, setPincode] = useState("");
  const [deliveryPreference, setDeliveryPreference] = useState<"courier" | "self_pickup" | "transport">("courier");
  const [transportName, setTransportName] = useState("");
  const [transportPhone, setTransportPhone] = useState("");
  const [transportGstin, setTransportGstin] = useState("");
  // Email + password registration state
  const [mode, setMode] = useState<RegisterMode>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<EmailPasswordRegistrationErrors>({});
  // OTP Verification State
  const [step, setStep] = useState<"details" | "otp">("details");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const gstinValidation = gstin.trim() ? validateGSTIN(gstin) : null;

  function fieldError(field: keyof EmailPasswordRegistrationErrors): string {
    const code = fieldErrors[field];
    if (!code) return "";
    return t(`register.err.${code satisfies EmailPasswordRegistrationErrorCode}`);
  }

  function fieldClass(field: keyof EmailPasswordRegistrationErrors): string {
    /* The shared .sl-v2-input primitive supplies geometry, focus ring and
       disabled state. Only the invalid variant is added here, so error styling
       can never drift away from the design system. */
    return fieldErrors[field]
      ? "sl-v2-input aria-invalid=true !border-[var(--sl-danger)]"
      : "sl-v2-input";
  }

  function switchMode(next: RegisterMode) {
    setMode(next);
    setError("");
    setMessage("");
    setFieldErrors({});
    if (next === "otp") {
      setStep("details");
      setCode("");
    }
  }

  /**
   * Registers through the EXISTING `POST /api/auth/register` endpoint. The
   * response already establishes the session cookie, so the buyer is simply
   * sent to the normal destination. No role is ever sent or selected.
   */
  /**
   * Optional business / delivery details. Rendered as a shared grid so the
   * email and OTP registration paths stay visually and behaviourally identical.
   */
  function OptionalProfileFields() {
    return (
      <>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="sl-label mb-1 block">
              {t("register.business")}
            </span>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder={t("register.phBusiness")}
              className="sl-v2-input"
            />
          </label>

          <label className="block sm:col-span-2">
            <div className="flex items-center justify-between">
              <span className="sl-label mb-1 block">
                {t("register.gstin")}
              </span>
              <span className="sl-small !text-[0.625rem] !uppercase">15 Chars</span>
            </div>
            <input
              type="text"
              maxLength={15}
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              placeholder={t("register.phGstin")}
              className={`sl-v2-input !font-mono ${
                gstin.trim() && gstinValidation
                  ? gstinValidation.valid
                    ? "!border-[var(--sl-success)]"
                    : "!border-[var(--sl-danger)]"
                  : ""
              }`}
            />
            {gstin.trim() && gstinValidation && (
              <p
                className={`sl-small mt-1.5 font-medium ${
                  gstinValidation.valid
                    ? "!text-[var(--sl-success)]"
                    : "!text-[var(--sl-danger)]"
                }`}
              >
                {gstinValidation.message}
              </p>
            )}
          </label>

          <label className="block sm:col-span-2">
            <span className="sl-label mb-1 block">
              {t("register.address")}
            </span>
            <input
              type="text"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              placeholder={t("register.phAddress")}
              className="sl-v2-input"
            />
          </label>

          <label className="block">
            <span className="sl-label mb-1 block">
              {t("register.city")}
            </span>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={t("register.phCity")}
              className="sl-v2-input"
            />
          </label>

          <label className="block">
            <span className="sl-label mb-1 block">
              {t("register.pincode")}
            </span>
            <input
              type="text"
              maxLength={6}
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
              placeholder="••••••••"
              className="sl-v2-input"
            />
          </label>

          <div className="sm:col-span-2">
            <span className="sl-label mb-1.5 block">
              {t("register.method")}
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(
                [
                  ["courier", t("register.courier")],
                  ["self_pickup", t("register.pickup")],
                  ["transport", t("register.transport")],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className="sl-v2-focus flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[var(--sl-radius-sm)] border border-[var(--sl-border)] bg-white p-3 text-sm text-[var(--sl-text-soft)] transition-colors has-checked:border-[var(--sl-primary)] has-checked:bg-[var(--sl-primary-soft)] has-checked:!text-[var(--sl-primary)]"
                >
                  <input
                    type="radio"
                    name={`deliveryPref-${mode}`}
                    value={value}
                    checked={deliveryPreference === value}
                    onChange={() => setDeliveryPreference(value as ShippingPreference)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            {deliveryPreference === "transport" && (
              <div className="mt-3 space-y-3 rounded-[var(--sl-radius-sm)] border border-[var(--sl-border)] bg-[var(--sl-surface-sunk)] p-4">
                <p className="sl-label">
                  {t("register.transportTitle")}
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <span className="sl-label mb-1 block">
                      {t("register.transporter")}{" "}
                      <span className="!text-[var(--sl-danger)]">*</span>
                    </span>
                    <input
                      required={deliveryPreference === "transport"}
                      value={transportName}
                      onChange={(e) => setTransportName(e.target.value)}
                      placeholder={t("register.phTransporter")}
                      className={`sl-v2-input !min-h-11 !text-sm ${
                        fieldErrors.transportName
                          ? "!border-[var(--sl-danger)]"
                          : ""
                      }`}
                    />
                    {fieldError("transportName") && (
                      <p className="sl-small mt-1.5 font-medium !text-[var(--sl-danger)]">
                        {fieldError("transportName")}
                      </p>
                    )}
                  </div>

                  <div>
                    <span className="sl-label mb-1 block">
                      {t("register.transportPhone")}
                    </span>
                    <input
                      value={transportPhone}
                      onChange={(e) => setTransportPhone(e.target.value)}
                      placeholder={t("register.phTransportPhone")}
                      className="sl-v2-input !min-h-11 !text-sm"
                    />
                  </div>

                  <div>
                    <span className="sl-label mb-1 block">
                      {t("register.transportGstin")}
                    </span>
                    <input
                      maxLength={15}
                      value={transportGstin}
                      onChange={(e) => setTransportGstin(e.target.value.toUpperCase())}
                      placeholder={t("profile.phTransportGstin")}
                      className="sl-v2-input !min-h-11 !font-mono !text-sm !uppercase"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  async function handleEmailRegister(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    const input = {
      fullName,
      email,
      password,
      confirmPassword,
      phoneNumber,
      businessName,
      gstin,
      addressLine1,
      city,
      state,
      pincode,
      shippingPreference: deliveryPreference,
      transportName,
      transportPhone,
      transportGstin,
    };

    const errors = validateEmailPasswordRegistration(input);
    setFieldErrors(errors);
    if (hasRegistrationErrors(errors)) return;

    setLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildEmailPasswordRegistrationPayload(input)),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || t("register.fail"));
      }

      setPassword("");
      setConfirmPassword("");
      setMessage(t("register.success"));
      router.push("/");
      router.refresh();
    } catch (err) {
      // Only the server's safe message is surfaced. The password is never
      // included in an error, logged, or echoed back to the user.
      setError(err instanceof Error ? err.message : t("register.fail"));
    } finally {
      setLoading(false);
    }
  }

  async function handleSendOtp(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!phoneNumber || !/^(?:\+91)?[6-9]\d{9}$/.test(phoneNumber.replace(/[\s-]/g, ""))) {
      setError(t("register.phoneInvalid"));
      return;
    }

    if (gstin.trim() && gstinValidation && !gstinValidation.valid) {
      setError(t("register.gstinInvalid"));
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/phone-number/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phoneNumber.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t("register.otpSendFail"));
      }

      setStep("otp");
      setMessage(t("register.otpSent", { phone: phoneNumber }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("register.initFail"));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/phone-number/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim(),
          code: code.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.status) {
        throw new Error(data.error || t("register.otpInvalid"));
      }

      // Persist entered customer profile details
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactName: fullName.trim(),
          businessName: businessName.trim() || undefined,
          gstin: gstin.trim().toUpperCase() || undefined,
          shippingAddressLine1: addressLine1.trim() || undefined,
          shippingCity: city.trim() || undefined,
          shippingState: state.trim() || undefined,
          shippingPincode: pincode.trim() || undefined,
          shippingPreference: deliveryPreference,
          transportName: deliveryPreference === "transport" ? transportName.trim() : undefined,
          transportPhone: deliveryPreference === "transport" ? transportPhone.trim() : undefined,
          transportGstin: deliveryPreference === "transport" && transportGstin.trim() ? transportGstin.trim().toUpperCase() : undefined,
        }),
      }).catch(() => null);

      setMessage(t("register.verified"));
      setTimeout(() => {
        router.push("/");
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("register.verifyFail"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sl-page flex min-h-screen flex-col text-[var(--sl-text)]">
      <StorefrontHeader />
      <AuthShell
        eyebrow={t("auth.registerEyebrow")}
        heading={t("auth.registerHeading")}
        intro={t("auth.registerIntro")}
        bullets={[
          { title: t("auth.registerB1"), body: t("auth.registerB1Body") },
          { title: t("auth.registerB2"), body: t("auth.registerB2Body") },
          { title: t("auth.registerB3"), body: t("auth.registerB3Body") },
        ]}
        footerNote={
          <p className="sl-small text-center">
            {t("register.already")}{" "}
            <Link
              href="/login"
              className="sl-v2-focus font-bold text-[var(--sl-primary)] hover:underline"
            >
              {t("register.signIn")}
            </Link>
          </p>
        }
      >
        {/* ---- Account creation method: a real choice, shown first ---- */}
        <fieldset>
          <legend className="sl-label mb-2">{t("register.modeTitle")}</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => switchMode("email")}
              aria-pressed={mode === "email"}
              className={`sl-v2-focus min-h-11 rounded-[var(--sl-radius-sm)] border p-3 text-left transition-colors ${
                mode === "email"
                  ? "border-[var(--sl-primary)] bg-[var(--sl-primary-soft)]"
                  : "border-[var(--sl-border)] bg-white hover:border-[var(--sl-border-strong)]"
              }`}
            >
              <span
                className={`sl-nav block !font-bold ${
                  mode === "email"
                    ? "!text-[var(--sl-primary)]"
                    : "!text-[var(--sl-text)]"
                }`}
              >
                {t("register.modeEmail")}
              </span>
              <span className="sl-small mt-0.5 block !text-[0.6875rem]">
                {t("register.modeEmailHint")}
              </span>
            </button>

            <button
              type="button"
              onClick={() => switchMode("otp")}
              aria-pressed={mode === "otp"}
              className={`sl-v2-focus min-h-11 rounded-[var(--sl-radius-sm)] border p-3 text-left transition-colors ${
                mode === "otp"
                  ? "border-[var(--sl-primary)] bg-[var(--sl-primary-soft)]"
                  : "border-[var(--sl-border)] bg-white hover:border-[var(--sl-border-strong)]"
              }`}
            >
              <span
                className={`sl-nav block !font-bold ${
                  mode === "otp"
                    ? "!text-[var(--sl-primary)]"
                    : "!text-[var(--sl-text)]"
                }`}
              >
                {t("register.modeOtp")}
              </span>
              <span className="sl-small mt-0.5 block !text-[0.6875rem]">
                {t("register.modeOtpHint")}
              </span>
            </button>
          </div>
        </fieldset>

        {/* ---- Form-level feedback: designed surfaces, not raw text ---- */}
        {error ? (
          <div
            role="alert"
            className="mt-5 flex items-start gap-2.5 rounded-[var(--sl-radius-sm)] border border-[#f0c8c5] bg-[var(--sl-danger-soft)] p-3.5 text-sm text-[var(--sl-danger)]"
          >
            <svg
              className="mt-0.5 h-4 w-4 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4.5M12 16h.01" />
            </svg>
            <span>{error}</span>
          </div>
        ) : null}

        {message ? (
          <div
            role="status"
            className="mt-5 flex items-start gap-2.5 rounded-[var(--sl-radius-sm)] border border-[#bfe3d4] bg-[var(--sl-success-soft)] p-3.5 text-sm text-[var(--sl-success)]"
          >
            <svg
              className="mt-0.5 h-4 w-4 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M8 12.5l2.5 2.5L16 9.5" />
            </svg>
            <span>{message}</span>
          </div>
        ) : null}

        {mode === "email" ? (
          <form
            onSubmit={handleEmailRegister}
            className="mt-6 space-y-5"
            noValidate
          >
            <div>
              <h2 className="sl-h3 !text-base">{t("register.emailHeading")}</h2>
              <p className="sl-small mt-1">{t("register.emailHint")}</p>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="sl-label mb-1 block">
                  {t("register.fullName")} <span className="!text-[var(--sl-danger)]">*</span>
                </span>
                <input
                  type="text"
                  autoComplete="name"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t("register.phName")}
                  className={fieldClass("fullName")}
                />
                {fieldError("fullName") ? (
                  <p className="sl-small mt-1.5 font-medium !text-[var(--sl-danger)]">
                    {fieldError("fullName")}
                  </p>
                ) : null}
              </label>

              <label className="block">
                <span className="sl-label mb-1 block">
                  {t("register.email")} <span className="!text-[var(--sl-danger)]">*</span>
                </span>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("register.phEmail")}
                  className={fieldClass("email")}
                />
                {fieldError("email") ? (
                  <p className="sl-small mt-1.5 font-medium !text-[var(--sl-danger)]">
                    {fieldError("email")}
                  </p>
                ) : null}
              </label>

              {/* Credential group is visually separated so the form reads as
                  two blocks: identity, then credentials. */}
              <div className="space-y-4 border-t border-[var(--sl-border)] pt-4">
                <label className="block">
                  <span className="sl-label mb-1 block">
                    {t("register.password")} <span className="!text-[var(--sl-danger)]">*</span>
                  </span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={PASSWORD_MIN_LENGTH}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    aria-describedby="register-password-hint"
                    className={fieldClass("password")}
                  />
                  <p id="register-password-hint" className="sl-small mt-1.5">
                    {t("register.passwordHint")}
                  </p>
                  {fieldError("password") ? (
                    <p className="sl-small mt-1.5 font-medium !text-[var(--sl-danger)]">
                      {fieldError("password")}
                    </p>
                  ) : null}
                </label>

                <label className="block">
                  <span className="sl-label mb-1 block">
                    {t("register.confirmPassword")}{" "}
                    <span className="!text-[var(--sl-danger)]">*</span>
                  </span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className={fieldClass("confirmPassword")}
                  />
                  {fieldError("confirmPassword") ? (
                    <p className="sl-small mt-1.5 font-medium !text-[var(--sl-danger)]">
                      {fieldError("confirmPassword")}
                    </p>
                  ) : null}
                </label>
              </div>

              <label className="block">
                <span className="sl-label mb-1 block">
                  {t("register.mobileOptional")}
                </span>
                <input
                  type="tel"
                  autoComplete="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+919876543210"
                  className={fieldClass("phoneNumber")}
                />
                {fieldError("phoneNumber") ? (
                  <p className="sl-small mt-1.5 font-medium !text-[var(--sl-danger)]">
                    {fieldError("phoneNumber")}
                  </p>
                ) : null}
              </label>
            </div>

            {OptionalProfileFields()}

            <button type="submit" disabled={loading} className="sl-v2-btn sl-v2-btn-primary w-full">
              {loading ? t("register.submittingEmail") : t("register.submitEmail")}
            </button>
          </form>
        ) : step === "details" ? (
          <form onSubmit={handleSendOtp} className="mt-6 space-y-5">
            <div>
              <h2 className="sl-h3 !text-base">{t("register.heading")}</h2>
              <p className="sl-small mt-1">{t("register.hint")}</p>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="sl-label mb-1 block">
                  {t("register.fullName")} <span className="!text-[var(--sl-danger)]">*</span>
                </span>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t("register.phName")}
                  className="sl-v2-input"
                />
              </label>

              <label className="block">
                <span className="sl-label mb-1 block">
                  {t("register.mobile")} <span className="!text-[var(--sl-danger)]">*</span>
                </span>
                <input
                  type="tel"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+919876543210"
                  className="sl-v2-input"
                />
              </label>
            </div>

            {OptionalProfileFields()}

            <button type="submit" disabled={loading} className="sl-v2-btn sl-v2-btn-primary w-full">
              {loading ? t("register.sending") : t("register.sendOtp")}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="mt-6 space-y-5">
            <div>
              <h2 className="sl-h3 !text-base">{t("register.otpTitle")}</h2>
              <p className="sl-small mt-1">{t("register.otpHint", { phone: phoneNumber })}</p>
            </div>

            <label className="block">
              <span className="sl-label mb-1 block">{t("register.otpLabel")}</span>
              <input
                type="text"
                required
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                className="sl-v2-input !text-center !font-mono !text-xl !tracking-[0.3em]"
              />
            </label>

            <button type="submit" disabled={loading} className="sl-v2-btn sl-v2-btn-primary w-full">
              {loading ? t("register.verifying") : t("register.verify")}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep("details");
                setCode("");
                setError("");
              }}
              className="sl-v2-btn sl-v2-btn-ghost w-full !min-h-11 !text-[0.8125rem]"
            >
              {t("register.edit")}
            </button>
          </form>
        )}
      </AuthShell>
      <SiteFooter />
    </div>
  );
}
