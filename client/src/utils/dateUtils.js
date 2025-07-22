export function formatDateIST(dateValue) {
  if (!dateValue) return '';
  return new Date(dateValue).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
}

export function formatDateTimeIST(dateValue) {
  if (!dateValue) return '';
  return new Date(dateValue).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
} 