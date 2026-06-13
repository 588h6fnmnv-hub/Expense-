export default function RowButton({
  title,
  color,
  onClick,
}: {
  title: string;
  color: "green" | "red" | "blue";
  onClick: () => void;
}) {
  const colorClasses =
    color === "green"
      ? "text-success-green bg-success-green/10 border border-success-green/20 hover:bg-success-green/15"
      : color === "red"
      ? "text-danger-red bg-danger-red/10 border border-danger-red/20 hover:bg-danger-red/15"
      : "text-blue-400 bg-blue-400/10 border border-blue-400/20 hover:bg-blue-400/15";

  return (
    <button
      onClick={onClick}
      type="button"
      className={`btn-hover-effect min-w-0 flex-1 rounded-xl py-3 text-xs font-semibold shadow-sm tracking-wide uppercase transition active:scale-95 ${colorClasses}`}
    >
      {title}
    </button>
  );
}
