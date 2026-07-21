"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type ApiResponse = {
  error?: string;
  message?: string;
  alreadyEntered?: boolean;
  entered?: boolean;
};

export function RandomDrawEntry() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [acceptedEligibility, setAcceptedEligibility] = useState(false);
  const [acceptedOfficialRules, setAcceptedOfficialRules] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [complete, setComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/random-draw/send-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          acceptedEligibility,
          acceptedOfficialRules,
        }),
      });
      const payload = (await response.json()) as ApiResponse;
      if (!response.ok) throw new Error(payload.error ?? "The code could not be sent.");
      setMessage(payload.message ?? "Check your email for a verification code.");
      if (payload.alreadyEntered) setComplete(true);
      else setCodeSent(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The code could not be sent.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function verifyEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/random-draw/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const payload = (await response.json()) as ApiResponse;
      if (!response.ok) throw new Error(payload.error ?? "The entry could not be completed.");
      setMessage(payload.message ?? "Your Random Draw entry is complete.");
      setComplete(true);
    } catch (verifyError) {
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : "The entry could not be completed.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (complete) {
    return (
      <section className="random-entry-card random-entry-success" aria-live="polite">
        <span className="panel-kicker">Entry confirmed</span>
        <h2>You have one shot in the Random Draw.</h2>
        <p>{message}</p>
        <p>
          Using this same email on a final Board will not create a duplicate
          drawing entry.
        </p>
        <Link className="button gold" href="/">
          Build a Board for the Skill Prizes
        </Link>
      </section>
    );
  }

  return (
    <section className="random-entry-card">
      {!codeSent ? (
        <form onSubmit={requestCode}>
          <div>
            <span className="panel-kicker">Free alternate entry</span>
            <h2>Enter without building a Board.</h2>
            <p>
              A completed final Board already includes one Random Draw entry.
              This form provides the same chance without requiring rankings.
            </p>
          </div>
          <label className="random-entry-field">
            <span>Email address</span>
            <input
              type="email"
              name="randomDrawEmail"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="random-entry-check">
            <input
              type="checkbox"
              checked={acceptedEligibility}
              onChange={(event) => setAcceptedEligibility(event.target.checked)}
              required
            />
            <span>
              I am at least 18 years old and a legal resident of the 50 United
              States or District of Columbia.
            </span>
          </label>
          <label className="random-entry-check">
            <input
              type="checkbox"
              checked={acceptedOfficialRules}
              onChange={(event) => setAcceptedOfficialRules(event.target.checked)}
              required
            />
            <span>
              I have read and accept the <Link href="/official-rules">Official Rules</Link>
              {" "}and <Link href="/privacy">Privacy Notice</Link>.
            </span>
          </label>
          {error && <p className="random-entry-message error" role="alert">{error}</p>}
          <button className="button gold" type="submit" disabled={loading}>
            {loading ? "Sending..." : "Send Verification Code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyEntry}>
          <div>
            <span className="panel-kicker">Check your inbox</span>
            <h2>Enter the six-digit code.</h2>
            <p>{message}</p>
            <p className="email-delivery-note">
              Not there after a minute? Check your Spam or Junk folder.
            </p>
          </div>
          <label className="random-entry-field">
            <span>Verification code</span>
            <input
              type="text"
              name="randomDrawVerificationCode"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              required
            />
          </label>
          {error && <p className="random-entry-message error" role="alert">{error}</p>}
          <div className="random-entry-actions">
            <button className="button gold" type="submit" disabled={loading}>
              {loading ? "Verifying..." : "Complete My Free Entry"}
            </button>
            <button
              className="button ghost"
              type="button"
              onClick={() => {
                setCodeSent(false);
                setCode("");
                setError("");
                setMessage("");
              }}
              disabled={loading}
            >
              Use a Different Email
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
