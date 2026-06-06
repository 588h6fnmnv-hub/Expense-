export default function RowButton({
  title,
  color,
  onClick,
}: {
  title: string;
  color: "green" | "red" | "blue";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`liquid-surface flex-1 rounded-[24px] p-4 text-sm font-extrabold shadow-sm transition duration-300 active:scale-95 ${
        color === "green"
          ? "text-emerald-700"
          : color === "red"
            ? "text-rose-700"
            : "text-blue-700"
      }`}
    >
      {title}
    </button>
  );
}
