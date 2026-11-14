export const REPORT_REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'hate', label: 'Hate or abuse' },
  { value: 'sexual', label: 'Nudity or sexual content' },
  { value: 'violence', label: 'Violence or threats' },
  { value: 'scam', label: 'Scam or fraud' },
  { value: 'other', label: 'Something else' },
] as const;

export type ReportType = 'post' | 'comment' | 'user';

export const reasonLabel = (value: string) => REPORT_REASONS.find((r) => r.value === value)?.label ?? value;
