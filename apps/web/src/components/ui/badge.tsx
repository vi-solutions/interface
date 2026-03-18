type BadgeColor =
  | "emerald"
  | "blue"
  | "amber"
  | "red"
  | "gray"
  | "violet"
  | "indigo";

const colors: Record<BadgeColor, string> = {
  emerald:
    "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200",
  blue: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
  amber: "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200",
  red: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200",
  gray: "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200",
  violet:
    "bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-200",
  indigo:
    "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200",
};

const statusColorMap: Record<string, BadgeColor> = {
  active: "emerald",
  draft: "gray",
  "on-hold": "amber",
  completed: "blue",
  archived: "red",
  // phases
  assessment: "blue",
  analysis: "indigo",
  restoration: "emerald",
  permitting: "amber",
  reporting: "violet",
};

interface BadgeProps {
  children: string;
  color?: BadgeColor;
}

export function Badge({ children, color }: BadgeProps) {
  const resolved = color ?? statusColorMap[children.toLowerCase()] ?? "gray";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[resolved]}`}
    >
      {children}
    </span>
  );
}
