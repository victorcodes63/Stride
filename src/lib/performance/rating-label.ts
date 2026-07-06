export function ratingLabel(score: number | null | undefined): string {
  if (score == null) return 'Not rated';
  if (score >= 5) return 'Exceptional';
  if (score >= 4) return 'Exceeds expectations';
  if (score >= 3) return 'Meets expectations';
  if (score >= 2) return 'Needs improvement';
  return 'Unsatisfactory';
}
