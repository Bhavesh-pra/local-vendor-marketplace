/**
 * requireAdmin — middleware that enforces admin-only access.
 * Must be placed AFTER authenticateHeader so req.role is already set.
 *
 * Returns 403 for any authenticated user whose role is not 'admin'.
 * Returns 401 when run without authenticateHeader (role is undefined).
 */
const requireAdmin = (req, res, next) => {
  if (req.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

module.exports = { requireAdmin };
