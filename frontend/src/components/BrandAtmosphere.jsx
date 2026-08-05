import { Zap } from "lucide-react";

function classNames(...values) {
  return values.filter(Boolean).join(" ");
}

/**
 * Shared ATD watermark layer — rings, logo, bolt, spark dots.
 * tone="dark" for navy heroes; tone="light" for form/catalog page grounds.
 */
export default function BrandAtmosphere({
  tone = "light",
  className = "",
}) {
  const dark = tone === "dark";

  return (
    <div
      className={classNames(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className
      )}
      aria-hidden="true"
    >
      {dark ? (
        <>
          <div className="absolute -left-24 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(125,211,252,0.12)_0%,transparent_70%)]" />
          <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(96,165,250,0.10)_0%,transparent_70%)]" />

          <div className="absolute -left-2 top-1/2 h-56 w-56 -translate-y-1/2 opacity-[0.14] sm:left-3 sm:h-64 sm:w-64">
            <div className="absolute inset-0 rounded-full border-[20px] border-white" />
            <div className="absolute inset-8 rounded-full border border-white" />
            <div className="absolute inset-0 flex items-center justify-center px-8">
              <img
                src="/helpdesk/atd-helpdesk-logo-light.png"
                alt=""
                className="w-[8.25rem] object-contain brightness-0 invert sm:w-40"
              />
            </div>
          </div>

          <div className="absolute -right-3 top-2 opacity-[0.14]">
            <Zap className="h-36 w-36 text-white" strokeWidth={1.1} />
          </div>

          <span className="absolute left-[16%] top-[18%] h-1.5 w-1.5 rounded-full bg-sky-200/35" />
          <span className="absolute left-[22%] bottom-[26%] h-1 w-1 rounded-full bg-white/30" />
          <span className="absolute left-[38%] top-[28%] h-1 w-1 rounded-full bg-sky-300/25" />
          <span className="absolute right-[30%] bottom-5 h-2 w-2 rounded-full bg-sky-200/30" />
          <span className="absolute right-[22%] bottom-10 h-1.5 w-1.5 rounded-full bg-white/25" />
          <span className="absolute right-[36%] top-8 h-1 w-1 rounded-full bg-sky-200/30" />
          <span className="absolute right-[18%] top-[42%] h-1 w-1 rounded-full bg-white/20" />
        </>
      ) : (
        <>
          <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(23,43,87,0.06)_0%,transparent_68%)]" />
          <div className="absolute -right-16 bottom-20 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(37,99,235,0.05)_0%,transparent_70%)]" />

          <div className="absolute -left-6 top-16 h-52 w-52 opacity-[0.08] sm:left-4 sm:top-20 sm:h-60 sm:w-60">
            <div className="absolute inset-0 rounded-full border-[18px] border-[#172b57]" />
            <div className="absolute inset-7 rounded-full border border-[#172b57]" />
            <div className="absolute inset-0 flex items-center justify-center px-7">
              <img
                src="/helpdesk/atd-helpdesk-logo-clear.png"
                alt=""
                className="w-32 object-contain sm:w-36"
              />
            </div>
          </div>

          <div className="absolute -right-4 top-28 opacity-[0.08] sm:right-6 sm:top-24">
            <Zap className="h-32 w-32 text-[#172b57]" strokeWidth={1.1} />
          </div>

          <span className="absolute left-[14%] top-[12%] h-1.5 w-1.5 rounded-full bg-[#172b57]/25" />
          <span className="absolute left-[20%] top-[38%] h-1 w-1 rounded-full bg-[#172b57]/20" />
          <span className="absolute left-[42%] top-10 h-1 w-1 rounded-full bg-sky-600/20" />
          <span className="absolute bottom-24 right-[18%] h-2 w-2 rounded-full bg-[#172b57]/20" />
          <span className="absolute bottom-36 right-[26%] h-1.5 w-1.5 rounded-full bg-sky-600/20" />
          <span className="absolute right-[12%] top-[22%] h-1 w-1 rounded-full bg-[#172b57]/18" />
          <span className="absolute bottom-16 left-[30%] h-1 w-1 rounded-full bg-[#172b57]/15" />
        </>
      )}
    </div>
  );
}
