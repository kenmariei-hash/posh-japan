export function parseEventDate(dateText: string) {
  const parsed = new Date(dateText);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  return null;
}

export function getCancellationDeadline(dateText: string) {
  const eventDate = parseEventDate(dateText);
  if (!eventDate) {
    return null;
  }

  return new Date(
    eventDate.getFullYear(),
    eventDate.getMonth(),
    eventDate.getDate(),
    0,
    0,
    0,
    0,
  );
}

export function canCancelPurchase(params: {
  eventDate?: string | null;
  checkedIn?: boolean | null;
  paymentStatus?: string | null;
  cancelledAt?: string | null;
}) {
  if (!params.eventDate) {
    return false;
  }

  if (params.checkedIn) {
    return false;
  }

  if (params.cancelledAt) {
    return false;
  }

  if (params.paymentStatus !== "paid") {
    return false;
  }

  const deadline = getCancellationDeadline(params.eventDate);
  if (!deadline) {
    return false;
  }

  return Date.now() < deadline.getTime();
}
