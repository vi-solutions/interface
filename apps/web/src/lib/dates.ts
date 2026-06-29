export function localDateFromDateString(value: string) {
  const [year, month, day] = toDateInputValue(value).split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function toDateInputValue(value: string | null | undefined) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayDateInputValue() {
  return dateToDateInputValue(new Date());
}

export function dateToDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateString(
  value: string,
  options?: Intl.DateTimeFormatOptions,
  locale?: string,
) {
  return localDateFromDateString(value).toLocaleDateString(locale, options);
}
