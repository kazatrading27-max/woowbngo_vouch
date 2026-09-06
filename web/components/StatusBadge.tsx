export function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'ACTIVE'
      ? 'badge-active'
      : status === 'REDEEMED'
        ? 'badge-redeemed'
        : status === 'REVOKED'
          ? 'badge-revoked'
          : 'badge-expired';
  return <span className={cls}>{status}</span>;
}
