export function calculateNotificationRetryTime(attempts: number): string {
  const delays = [
    30_000, // 30 seconds
    60_000, // 1 minute
    5 * 60_000, // 5 minutes
    15 * 60_000, // 15 minutes
    30 * 60_000, // 30 minutes
    60 * 60_000, // 1 hour
  ];

  const index = Math.min(attempts, delays.length - 1);

  return new Date(Date.now() + delays[index]).toISOString();
}
