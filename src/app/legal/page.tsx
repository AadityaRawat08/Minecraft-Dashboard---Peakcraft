import Link from "next/link";

export default function LegalPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16 text-slate-300">
      <Link href="/" className="text-sm text-emerald-400 hover:underline">&larr; Back home</Link>
      <h1 id="terms" className="mt-8 scroll-mt-16 text-3xl font-bold text-white">Terms of Service</h1>
      <div className="mt-4 space-y-4 text-sm leading-relaxed">
        <p>By creating an account and using Peakcraft Panel, you agree to use the platform only for lawful purposes and in accordance with the Minecraft End User License Agreement (EULA).</p>
        <p>You are responsible for the content and configuration of servers you create. Resource allocations are subject to fair-use limits described on your account and may be adjusted to keep the platform stable for all users.</p>
        <p>We may suspend or remove servers and accounts that violate these terms, abuse shared infrastructure, or attempt to circumvent security controls.</p>
      </div>

      <h1 id="privacy" className="mt-12 scroll-mt-16 text-3xl font-bold text-white">Privacy Policy</h1>
      <div className="mt-4 space-y-4 text-sm leading-relaxed">
        <p>We store the minimum data required to operate your account and servers: your username, email address, hashed password, and metadata about the servers you create (name, configuration, resource usage).</p>
        <p>Passwords are always hashed and never stored in plaintext. Session tokens are stored as secure, HTTP-only cookies. We do not sell personal data to third parties.</p>
        <p>Administrative audit logs capture security-relevant actions (logins, server lifecycle changes, administrative actions) for the safety and integrity of the platform.</p>
      </div>
    </main>
  );
}
