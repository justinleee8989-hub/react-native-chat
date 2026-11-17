export function profileEmail (person: unknown): string {
  if (person && typeof person === 'object' && 'email' in person && typeof person.email === 'string' && person.email.trim())
    return person.email
  return '—'
}
