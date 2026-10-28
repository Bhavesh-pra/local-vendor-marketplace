const ALLOWED_TRANSITIONS = {
  DRAFT: ['SENT', 'CANCELLED'],
  SENT: ['ACKNOWLEDGED', 'CANCELLED'],
  ACKNOWLEDGED: ['PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'],
  PARTIALLY_RECEIVED: ['PARTIALLY_RECEIVED', 'RECEIVED'],
  RECEIVED: [],
  CANCELLED: []
};

const isTransitionAllowed = (fromState, toState) => {
  const allowed = ALLOWED_TRANSITIONS[fromState] || [];
  return allowed.includes(toState);
};

const getAllowedActions = (state) => {
  return ALLOWED_TRANSITIONS[state] || [];
};

module.exports = {
  isTransitionAllowed,
  getAllowedActions
};
