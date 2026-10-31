const money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const dateTime = new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeStyle: 'short' });

export const formatPrice = (cents) => money.format((cents ?? 0) / 100);
export const formatDateTime = (iso) => (iso ? dateTime.format(new Date(iso)) : '');
