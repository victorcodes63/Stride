/** Personal-view opt-in to merge full company calendar (interviews + company events). */
export const CALENDAR_INCLUDE_COMPANY_STORAGE_KEY = 'eagle.calendar.includeCompany';

export function readIncludeCompanyPreference(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(CALENDAR_INCLUDE_COMPANY_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeIncludeCompanyPreference(value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CALENDAR_INCLUDE_COMPANY_STORAGE_KEY, value ? '1' : '0');
  } catch {
    /* ignore quota / private mode */
  }
}
