export default function ModerationPage() {
  const reports = [
    {
      id: 'rep_1',
      reelTitle: 'Beginner Modular Synthesizer Patching Guide',
      creator: '@synth_nerd',
      reason: 'Tag Manipulation',
      details:
        'Creator tagged Horology & Watchmaking in an electronics audio video to gain unrelated impressions.',
      status: 'PENDING',
      reportedAt: '12 mins ago',
    },
    {
      id: 'rep_2',
      reelTitle: 'Titanium Impeller 5-Axis Milling Run',
      creator: '@cnc_machinist',
      reason: 'Spam / Watermark',
      details: 'Video contains prominent external promotion watermark.',
      status: 'PENDING',
      reportedAt: '45 mins ago',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">
          Content Moderation & Trust
        </h1>
        <p className="text-zinc-400 mt-1">
          Review community reports, safety flags, and automated tag-to-vector mismatch detections.
        </p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
          <span className="font-bold text-sm text-white">Active Reports ({reports.length})</span>
          <span className="text-xs text-zinc-400">
            Zero-location moderation: governed purely by community safety rules
          </span>
        </div>

        <div className="divide-y divide-zinc-850">
          {reports.map((rep) => (
            <div
              key={rep.id}
              className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center space-x-3">
                  <span className="bg-rose-950/80 text-rose-400 border border-rose-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
                    {rep.reason}
                  </span>
                  <span className="text-xs text-zinc-500">{rep.reportedAt}</span>
                </div>
                <h3 className="font-bold text-white text-base pt-1">{rep.reelTitle}</h3>
                <p className="text-sm text-zinc-400">{rep.details}</p>
                <div className="text-xs text-zinc-500">
                  Creator: <span className="text-zinc-300 font-medium">{rep.creator}</span>
                </div>
              </div>

              <div className="flex space-x-2 shrink-0">
                <button className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold px-4 py-2 rounded-xl transition">
                  Dismiss
                </button>
                <button className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition shadow-lg shadow-rose-900/40">
                  Strip Tags / Strike
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
