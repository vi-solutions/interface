import { type ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  message: string;
  sub?: string;
}

export function EmptyState({ icon, message, sub }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && (
        <div className="text-gray-300 dark:text-gray-600 mb-3">{icon}</div>
      )}
      <p className="text-gray-500 dark:text-gray-400 text-sm">{message}</p>
      {sub && (
        <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">{sub}</p>
      )}
    </div>
  );
}
