export default function BalanceCard({
  emoji,
  balance,
  spent,
  saved,
  onClick,
}: {
  emoji: string;
  balance: number;
  spent: number;
  saved: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="wallet-card group relative min-h-[214px] w-full overflow-hidden rounded-[32px] bg-black p-6 text-left text-white shadow-[0_26px_65px_rgba(15,23,42,0.36)] transition duration-500 active:scale-[0.985]"
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#1f2937_0%,#020617_48%,#111827_100%)]" />
      <div className="absolute inset-x-0 top-0 h-28 bg-white/10 blur-2xl" />
      <div className="absolute bottom-0 right-0 h-32 w-2/3 bg-[linear-gradient(135deg,transparent,rgba(56,189,248,0.34),rgba(217,70,239,0.28))] blur-2xl" />
      <div className="absolute left-6 top-6 h-9 w-12 rounded-xl bg-gradient-to-br from-yellow-100 via-yellow-400 to-amber-700 shadow-inner" />

      <div className="relative flex min-h-[166px] flex-col justify-between">
        <div className="flex items-start justify-between">
          <div className="pt-12">
            <p className="text-sm font-semibold text-white/60">{emoji} Balance</p>
            <h1 className="mt-2 text-5xl font-black tracking-tight">
              ₹{balance.toFixed(0)}
            </h1>
          </div>

          <div className="flex gap-1.5 pt-1">
            <span className="h-6 w-6 rounded-full bg-red-500/90" />
            <span className="-ml-3 h-6 w-6 rounded-full bg-orange-400/90" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/12 p-3 backdrop-blur-xl">
            <p className="text-xs font-medium text-white/50">Payment Out</p>
            <p className="mt-1 text-lg font-extrabold text-red-200">
              ₹{spent.toFixed(0)}
            </p>
          </div>

          <div className="rounded-2xl bg-white/12 p-3 text-right backdrop-blur-xl">
            <p className="text-xs font-medium text-white/50">Available</p>
            <p className="mt-1 text-lg font-extrabold text-emerald-200">
              ₹{saved.toFixed(0)}
            </p>
          </div>
        </div>
      </div>
    </button>
  );
}
