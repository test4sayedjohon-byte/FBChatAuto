export interface BillingCycle {
  startDate: Date;
  endDate: Date;
  daysRemaining: number;
}

export function calculateBillingCycle(
  registrationDateStr: string | undefined,
  purchases: { created_at: string; status: string; payment_method?: string }[]
): BillingCycle {
  // Find latest approved purchase (excluding admin gifts)
  const latestApproved = [...purchases]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .find(p => p.status === 'approved' && p.payment_method !== 'gift');
  
  let cycleAnchor = new Date();
  if (latestApproved) {
    cycleAnchor = new Date(latestApproved.created_at);
  } else if (registrationDateStr) {
    cycleAnchor = new Date(registrationDateStr);
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  
  // Set starting point to this month, at the anchor's day of month
  let startDate = new Date(currentYear, currentMonth, cycleAnchor.getDate(), cycleAnchor.getHours(), cycleAnchor.getMinutes(), cycleAnchor.getSeconds());
  
  // If the anchor day is greater than number of days in current month, handle overflow
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  if (cycleAnchor.getDate() > daysInMonth) {
    startDate.setDate(daysInMonth);
  }
  
  // If the calculated startDate is in the future, the cycle started last month
  if (startDate > now) {
    let prevMonth = currentMonth - 1;
    let prevYear = currentYear;
    if (prevMonth < 0) {
      prevMonth = 11;
      prevYear -= 1;
    }
    startDate = new Date(prevYear, prevMonth, cycleAnchor.getDate(), cycleAnchor.getHours(), cycleAnchor.getMinutes(), cycleAnchor.getSeconds());
    const daysInPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();
    if (cycleAnchor.getDate() > daysInPrevMonth) {
      startDate.setDate(daysInPrevMonth);
    }
  }

  // End date is exactly 1 month after start date
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1);
  
  // Calculate days remaining
  const diffTime = endDate.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  return {
    startDate,
    endDate,
    daysRemaining
  };
}
