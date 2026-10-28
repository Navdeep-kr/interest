'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  ShieldCheck,
  Zap,
  ArrowRight,
  CheckCircle2,
  Users,
  Compass,
  Lock,
  Headphones,
  Coffee,
  Keyboard,
  Share2,
  Copy,
  Check,
  TrendingUp,
} from 'lucide-react';

export default function LandingPage() {
  const [email, setEmail] = useState('');
  const [selectedNiches, setSelectedNiches] = useState<string[]>(['Modular Synthesizers']);
  const [joined, setJoined] = useState(false);
  const [copied, setCopied] = useState(false);
  const [queueNumber, setQueueNumber] = useState(14820);
  const [referralCode, setReferralCode] = useState('');

  const nicheOptions = [
    { id: 'Modular Synthesizers', icon: Headphones, count: '48k enthusiasts' },
    { id: 'Specialty Coffee & Roasting', icon: Coffee, count: '82k baristas' },
    { id: 'Mechanical Keyboards & ASMR', icon: Keyboard, count: '115k makers' },
    { id: 'Ceramics & Wheel Throwing', icon: Sparkles, count: '39k artisans' },
    { id: 'Creative Coding & Shaders', icon: Zap, count: '54k hackers' },
  ];

  const toggleNiche = (niche: string) => {
    if (selectedNiches.includes(niche)) {
      if (selectedNiches.length > 1) {
        setSelectedNiches(selectedNiches.filter((n) => n !== niche));
      }
    } else {
      setSelectedNiches([...selectedNiches, niche]);
    }
  };

  const handleJoinWaitlist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setReferralCode(code);
    setJoined(true);
  };

  const copyReferralLink = () => {
    navigator.clipboard.writeText(`https://interest.app/join?ref=${referralCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-indigo-500 selection:text-white">
      {/* --------------------------------------------------------------------- */}
      {/* Top Navigation */}
      {/* --------------------------------------------------------------------- */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
              I
            </div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              Interest
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-medium">
              Zero-Location
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-xs text-zinc-400 hover:text-zinc-200 transition"
            >
              Admin Portal
            </Link>
            <a
              href="#waitlist"
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 transition"
            >
              Get Early Access
            </a>
          </div>
        </div>
      </header>

      {/* --------------------------------------------------------------------- */}
      {/* Hero Section */}
      {/* --------------------------------------------------------------------- */}
      <section className="relative pt-20 pb-24 overflow-hidden border-b border-zinc-800/60">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.18),rgba(255,255,255,0))]" />

        <div className="max-w-5xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-6">
            <ShieldCheck className="w-3.5 h-3.5" />
            100% Geo-Blind Recommendation Engine • No GPS • No City Tracking
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white mb-6 leading-[1.1]">
            Stop scrolling strangers. <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
              Start scrolling your obsessions.
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-base sm:text-lg text-zinc-400 mb-10 leading-relaxed">
            The world’s first pure interest-driven social video app. No local gossip, no viral dance trends, and no geographic pigeonholing. Just deep craft, high-signal reels, and the creators who master them.
          </p>

          {/* Waitlist Form Component */}
          <div id="waitlist" className="max-w-xl mx-auto mb-12">
            {!joined ? (
              <form onSubmit={handleJoinWaitlist} className="bg-zinc-900/90 border border-zinc-800 p-3 rounded-2xl shadow-2xl backdrop-blur">
                <div className="text-left px-3 pt-2 pb-3">
                  <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-2">
                    Pick your launch obsessions (select at least 1):
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {nicheOptions.map((niche) => {
                      const isSelected = selectedNiches.includes(niche.id);
                      const Icon = niche.icon;
                      return (
                        <button
                          key={niche.id}
                          type="button"
                          onClick={() => toggleNiche(niche.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm shadow-indigo-600/40'
                              : 'bg-zinc-800/80 text-zinc-400 border-zinc-700/60 hover:text-zinc-200'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {niche.id}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your personal email..."
                    className="flex-1 bg-zinc-950 border border-zinc-700/80 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition"
                  />
                  <button
                    type="submit"
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition"
                  >
                    Join Waitlist <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            ) : (
              /* Success & Viral Referral Card */
              <div className="bg-zinc-900 border border-indigo-500/40 p-6 rounded-2xl shadow-2xl text-left animate-in fade-in zoom-in duration-300">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white">You are on the VIP Waitlist!</h3>
                    <p className="text-xs text-zinc-400">Position #{queueNumber.toLocaleString()} • Seed Cohort Reserved</p>
                  </div>
                </div>

                <div className="bg-zinc-950/80 border border-zinc-800 p-4 rounded-xl mb-4">
                  <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
                    <span className="font-semibold text-zinc-300">Viral Fast-Track:</span>
                    <span className="text-indigo-400 font-bold">3 Invites = Instant Access</span>
                  </div>
                  <p className="text-xs text-zinc-400 mb-3">
                    Skip 1,000 spots for every friend who joins using your link. 3 friends unlocks immediate TestFlight alpha access!
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`https://interest.app/join?ref=${referralCode}`}
                      className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono select-all"
                    />
                    <button
                      type="button"
                      onClick={copyReferralLink}
                      className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-1.5 transition"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-8 text-xs text-zinc-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> 150 Founding Creators Funded
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> $100k Seed Creator Fund
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Zero Location Advertising
            </span>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------- */}
      {/* The 3 Launch Niche Communities */}
      {/* --------------------------------------------------------------------- */}
      <section className="py-20 max-w-6xl mx-auto px-6 border-b border-zinc-800/60">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-xs uppercase tracking-widest text-indigo-400 font-bold mb-2">Niche-First Launch</h2>
          <p className="text-3xl font-extrabold text-white">Dominating 3 Obsessive Craft Communities</p>
          <p className="text-sm text-zinc-400 mt-3">
            We don’t launch with a dilute feed. We seed thousands of hours of master-level craft before the public gates open.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Niche 1 */}
          <div className="bg-zinc-900/60 border border-zinc-800 p-6 rounded-2xl relative overflow-hidden group hover:border-indigo-500/40 transition">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-5">
              <Headphones className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-white mb-2">Modular Synthesizers & Sound Design</h3>
            <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
              Eurorack patches, diode ladder filters, and ambient generative soundscapes. High-fidelity uncompressed stereo audio with zero algorithm muting.
            </p>
            <div className="flex flex-wrap gap-1.5 text-[11px] font-mono text-zinc-400 mb-6">
              <span className="px-2 py-0.5 rounded bg-zinc-800">#Eurorack</span>
              <span className="px-2 py-0.5 rounded bg-zinc-800">#AnalogCircuits</span>
              <span className="px-2 py-0.5 rounded bg-zinc-800">#SoundDesign</span>
            </div>
            <div className="text-[11px] text-indigo-400 font-semibold flex items-center gap-1">
              50 Founding Creators Active <ArrowRight className="w-3 h-3" />
            </div>
          </div>

          {/* Niche 2 */}
          <div className="bg-zinc-900/60 border border-zinc-800 p-6 rounded-2xl relative overflow-hidden group hover:border-amber-500/40 transition">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-5">
              <Coffee className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-white mb-2">Specialty Coffee & Artisan Roasting</h3>
            <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
              Single-origin Gesha dial-ins, refractometer extraction yields, slow-motion pour-overs, and microfoam latte art physics. No drive-thru sugar syrups.
            </p>
            <div className="flex flex-wrap gap-1.5 text-[11px] font-mono text-zinc-400 mb-6">
              <span className="px-2 py-0.5 rounded bg-zinc-800">#EspressoProfiling</span>
              <span className="px-2 py-0.5 rounded bg-zinc-800">#PourOverCraft</span>
              <span className="px-2 py-0.5 rounded bg-zinc-800">#RoastCurve</span>
            </div>
            <div className="text-[11px] text-amber-400 font-semibold flex items-center gap-1">
              50 Founding Creators Active <ArrowRight className="w-3 h-3" />
            </div>
          </div>

          {/* Niche 3 */}
          <div className="bg-zinc-900/60 border border-zinc-800 p-6 rounded-2xl relative overflow-hidden group hover:border-purple-500/40 transition">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-5">
              <Keyboard className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-white mb-2">Mechanical Keyboards & ASMR</h3>
            <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
              PBT keycaps, switch lubing teardowns, brass weight acoustics, and tactile typing sound tests. Every thock and clack rendered in pristine fidelity.
            </p>
            <div className="flex flex-wrap gap-1.5 text-[11px] font-mono text-zinc-400 mb-6">
              <span className="px-2 py-0.5 rounded bg-zinc-800">#SwitchLubing</span>
              <span className="px-2 py-0.5 rounded bg-zinc-800">#ThockyASMR</span>
              <span className="px-2 py-0.5 rounded bg-zinc-800">#CustomKeyboards</span>
            </div>
            <div className="text-[11px] text-purple-400 font-semibold flex items-center gap-1">
              50 Founding Creators Active <ArrowRight className="w-3 h-3" />
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------- */}
      {/* Comparison: Mainstream Social vs. Interest */}
      {/* --------------------------------------------------------------------- */}
      <section className="py-20 max-w-5xl mx-auto px-6 border-b border-zinc-800/60">
        <div className="text-center max-w-xl mx-auto mb-14">
          <h2 className="text-xs uppercase tracking-widest text-indigo-400 font-bold mb-2">The Difference</h2>
          <p className="text-3xl font-extrabold text-white">Mainstream Algorithms vs. Interest</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="py-4 px-4 text-xs font-semibold text-zinc-400 uppercase">Feature</th>
                <th className="py-4 px-4 text-xs font-semibold text-rose-400 uppercase">Legacy Platforms (TikTok / Reels)</th>
                <th className="py-4 px-4 text-xs font-semibold text-emerald-400 uppercase">Interest Platform</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-xs">
              <tr>
                <td className="py-4 px-4 font-semibold text-white">Location Targeting</td>
                <td className="py-4 px-4 text-zinc-400">Forces local city memes, regional politics, and neighborhood chatter.</td>
                <td className="py-4 px-4 text-emerald-300 font-medium">100% Geo-Blind. Zero GPS, IP city, or regional filters used.</td>
              </tr>
              <tr>
                <td className="py-4 px-4 font-semibold text-white">Feed Optimization</td>
                <td className="py-4 px-4 text-zinc-400">Optimizes for lowest-common-denominator rage bait and dance memes.</td>
                <td className="py-4 px-4 text-emerald-300 font-medium">Deep mathematical vector cosine similarity on authentic craft.</td>
              </tr>
              <tr>
                <td className="py-4 px-4 font-semibold text-white">Algorithmic Transparency</td>
                <td className="py-4 px-4 text-zinc-400">Black box. Users have zero clue why content is forced into their feed.</td>
                <td className="py-4 px-4 text-emerald-300 font-medium">One-tap "Why am I seeing this?" breaking down exact vector affinity.</td>
              </tr>
              <tr>
                <td className="py-4 px-4 font-semibold text-white">Creator Economics</td>
                <td className="py-4 px-4 text-zinc-400">Pennies per million views; forces sponsorships & dropshipping merch.</td>
                <td className="py-4 px-4 text-emerald-300 font-medium">$100k Seed Creator Fund, Tips, and Paid Interest Communities.</td>
              </tr>
              <tr>
                <td className="py-4 px-4 font-semibold text-white">Privacy Architecture</td>
                <td className="py-4 px-4 text-zinc-400">Continuous telemetry tracking and location ad profiling.</td>
                <td className="py-4 px-4 text-emerald-300 font-medium">GDPR, DPDP, CCPA, and COPPA privacy-by-design architecture.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* --------------------------------------------------------------------- */}
      {/* Footer */}
      {/* --------------------------------------------------------------------- */}
      <footer className="py-12 max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-500 gap-4">
        <div>© 2026 Interest Social Inc. All rights reserved. Zero-Location Architecture.</div>
        <div className="flex gap-6">
          <Link href="/compliance" className="hover:text-zinc-300 transition">Privacy Policy</Link>
          <Link href="/compliance" className="hover:text-zinc-300 transition">Terms of Service</Link>
          <Link href="/compliance" className="hover:text-zinc-300 transition">Community Guidelines</Link>
          <Link href="/" className="hover:text-zinc-300 transition">Admin Portal</Link>
        </div>
      </footer>
    </div>
  );
}
