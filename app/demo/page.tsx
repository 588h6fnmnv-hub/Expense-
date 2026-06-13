import Link from "next/link";

const whatsappMessage =
  "Hi, I want to see a Ledge demo for my construction business.";

const features = [
  "Add expenses in seconds",
  "Track site profit and pending payments",
  "Worker slips and reminders on WhatsApp",
  "Bills, materials, and reports in one place",
  "Works offline and syncs when internet returns",
];

const mockTransactions = [
  ["Cement bill", "-₹92,400", "Green Heights"],
  ["Ramesh payment", "+₹6,50,000", "UPI received"],
  ["Imran Mason", "-₹18,000", "Worker slip"],
];

export default function DemoLandingPage() {
  return (
    <main className="min-h-dvh bg-[#f7f8f5] text-neutral-950">
      <section className="mx-auto grid min-h-dvh max-w-6xl gap-8 px-5 pb-12 pt-5 md:grid-cols-[1fr_420px] md:items-center md:pt-8">
        <div className="flex flex-col justify-center">
          <Link href="/" className="w-fit rounded-full bg-black px-4 py-2 text-sm font-black text-white">
            Open Ledge
          </Link>
          <h1 className="mt-8 max-w-2xl text-5xl font-black leading-[0.95] tracking-tight md:text-7xl">
            Ledge
          </h1>
          <p className="mt-5 max-w-xl text-xl font-bold leading-8 text-neutral-600">
            A fast mobile money app for Indian construction managers who need to
            know site spending, worker dues, material bills, and pending payments
            without learning accounting software.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`}
              className="rounded-3xl bg-emerald-600 px-6 py-4 text-center font-black text-white shadow-xl shadow-emerald-900/10 active:scale-[0.98]"
            >
              Request Demo on WhatsApp
            </a>
            <Link
              href="/"
              className="rounded-3xl border border-neutral-300 bg-white px-6 py-4 text-center font-black active:scale-[0.98]"
            >
              Open Demo Company
            </Link>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            {features.map((feature) => (
              <div key={feature} className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="font-extrabold">{feature}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto w-full max-w-[390px]">
          <div className="rounded-[42px] border border-black/10 bg-neutral-950 p-3 shadow-2xl">
            <div className="overflow-hidden rounded-[34px] bg-[#f8fafc]">
              <div className="bg-black px-5 pb-6 pt-5 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black uppercase text-white/45">Demo company</p>
                    <h2 className="mt-1 text-2xl font-black">Shree BuildCare</h2>
                  </div>
                  <span className="rounded-2xl bg-emerald-400 px-3 py-2 text-xs font-black text-black">
                    Live
                  </span>
                </div>
                <p className="mt-6 text-sm font-bold text-white/55">Site profit</p>
                <p className="mt-1 text-5xl font-black">₹14.8L</p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-white/10 p-3">
                    <p className="text-xs text-white/55">Pending</p>
                    <p className="mt-1 text-xl font-black">₹3.5L</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-3">
                    <p className="text-xs text-white/55">Bills</p>
                    <p className="mt-1 text-xl font-black">12</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 p-4">
                <div className="grid grid-cols-3 gap-2">
                  {["Expense", "Bill", "Share"].map((item) => (
                    <div key={item} className="rounded-2xl bg-white p-3 text-center text-sm font-black shadow-sm">
                      {item}
                    </div>
                  ))}
                </div>
                {mockTransactions.map(([title, amount, meta]) => (
                  <div key={title} className="rounded-3xl bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-black">{title}</p>
                        <p className="mt-1 text-sm font-bold text-neutral-400">{meta}</p>
                      </div>
                      <p className={`font-black ${amount.startsWith("+") ? "text-emerald-600" : "text-rose-600"}`}>
                        {amount}
                      </p>
                    </div>
                  </div>
                ))}
                <div className="grid grid-cols-5 gap-1 rounded-3xl bg-white p-2 text-center text-xs font-black text-neutral-500 shadow-sm">
                  {["Home", "Sites", "Add", "Reports", "Settings"].map((item) => (
                    <span key={item} className={item === "Add" ? "rounded-2xl bg-black py-2 text-white" : "py-2"}>
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-neutral-200 bg-white px-5 py-12">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3">
          <div className="rounded-3xl bg-[#f7f8f5] p-6">
            <p className="text-sm font-black uppercase text-neutral-400">Problem</p>
            <h2 className="mt-2 text-2xl font-black">Money details are scattered.</h2>
            <p className="mt-3 font-bold leading-7 text-neutral-600">
              Site expenses, worker advances, bills, and client collections live
              across WhatsApp, notebooks, and memory.
            </p>
          </div>
          <div className="rounded-3xl bg-[#f7f8f5] p-6">
            <p className="text-sm font-black uppercase text-neutral-400">Solution</p>
            <h2 className="mt-2 text-2xl font-black">One simple mobile flow.</h2>
            <p className="mt-3 font-bold leading-7 text-neutral-600">
              Home, Add, Sites, Reports, and WhatsApp sharing are always one tap
              away.
            </p>
          </div>
          <div className="rounded-3xl bg-black p-6 text-white">
            <p className="text-sm font-black uppercase text-white/45">Pricing</p>
            <h2 className="mt-2 text-2xl font-black">Starter pricing coming soon.</h2>
            <p className="mt-3 font-bold leading-7 text-white/60">
              Demo plan available for early contractors and construction teams.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
