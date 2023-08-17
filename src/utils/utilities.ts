export function toMS(hours: number, minutes: number) {
  return hours * 60 * 60 * 1000 + minutes * 60 * 1000
}

export function toHoursAndMinutes(ms: number) {
  const hours = Math.floor(ms / (60 * 60 * 1000))
  const minutes = Math.floor((ms - hours * 60 * 60 * 1000) / (60 * 1000))
  return { hours, minutes }
}