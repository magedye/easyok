export function uniqueEmail(prefix = 'e2e') {
  const ts = Date.now();
  return `${prefix}+${ts}@example.com`;
}
