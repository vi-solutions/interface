interface ErrorAlertProps {
  message: string;
  className?: string;
}

export function ErrorAlert({ message, className = "" }: ErrorAlertProps) {
  return (
    <div
      className={`text-red-600 bg-red-50 dark:bg-red-900/30 rounded-lg p-4 mb-4 text-sm ${className}`}
    >
      {message}
    </div>
  );
}
