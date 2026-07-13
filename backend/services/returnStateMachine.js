const ALLOWED_TRANSITIONS = {
  REQUESTED: ['APPROVED', 'REJECTED'],
  APPROVED: ['PICKUP_SCHEDULED'],
  PICKUP_SCHEDULED: ['PICKED_UP'],
  PICKED_UP: ['RECEIVED'],
  RECEIVED: ['REFUNDED', 'REPLACEMENT_SHIPPED'],
  REFUNDED: ['REFUND_COMPLETED'],
  REPLACEMENT_SHIPPED: ['REPLACEMENT_COMPLETED'],
  REFUND_COMPLETED: [],
  REPLACEMENT_COMPLETED: [],
  REJECTED: []
};

const isTransitionAllowed = (currentStatus, nextStatus, requestType) => {
  const allowed = ALLOWED_TRANSITIONS[currentStatus];
  if (!allowed) return false;

  if (currentStatus === 'RECEIVED') {
    if (requestType === 'return') {
      return nextStatus === 'REFUNDED';
    }
    if (requestType === 'replacement') {
      return nextStatus === 'REPLACEMENT_SHIPPED';
    }
    return false;
  }

  return allowed.includes(nextStatus);
};

const getAllowedActions = (status, requestType) => {
  if (status === 'RECEIVED') {
    return requestType === 'return' ? ['REFUNDED'] : ['REPLACEMENT_SHIPPED'];
  }
  return ALLOWED_TRANSITIONS[status] || [];
};

const getStepIndex = (status, requestType) => {
  if (status === 'REJECTED') {
    return { index: 1, isRejected: true };
  }

  const steps = requestType === 'return'
    ? ['REQUESTED', 'APPROVED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'RECEIVED', 'REFUNDED', 'REFUND_COMPLETED']
    : ['REQUESTED', 'APPROVED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'RECEIVED', 'REPLACEMENT_SHIPPED', 'REPLACEMENT_COMPLETED'];

  const index = steps.indexOf(status);
  return { index: index !== -1 ? index : 0, isRejected: false };
};

module.exports = {
  isTransitionAllowed,
  getAllowedActions,
  getStepIndex
};
