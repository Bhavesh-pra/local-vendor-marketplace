const validateSchema = (schema) => {
  return (req, res, next) => {
    const errors = {};
    
    const checkGroup = (groupName, data, rules) => {
      if (!rules) return;
      for (const [field, rule] of Object.entries(rules)) {
        const val = data[field];
        
        // 1. Required Check
        if (rule.required && (val === undefined || val === null || val === '')) {
          errors[field] = `${field} is required`;
          continue;
        }

        if (val !== undefined && val !== null && val !== '') {
          // 2. Type/Format checks
          if (rule.type === 'email') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(String(val))) {
              errors[field] = 'Invalid email address';
            }
          }
          else if (rule.type === 'number') {
            const num = Number(val);
            if (isNaN(num)) {
              errors[field] = `${field} must be a number`;
            } else {
              if (rule.min !== undefined && num < rule.min) {
                errors[field] = `${field} must be at least ${rule.min}`;
              }
              if (rule.max !== undefined && num > rule.max) {
                errors[field] = `${field} must be at most ${rule.max}`;
              }
            }
          }
          else if (rule.type === 'integer') {
            const num = Number(val);
            if (!Number.isInteger(num)) {
              errors[field] = `${field} must be an integer`;
            } else {
              if (rule.min !== undefined && num < rule.min) {
                errors[field] = `${field} must be at least ${rule.min}`;
              }
            }
          }
          else if (rule.type === 'string') {
            const s = String(val);
            if (rule.minLength !== undefined && s.length < rule.minLength) {
              errors[field] = `${field} must be at least ${rule.minLength} characters`;
            }
            if (rule.maxLength !== undefined && s.length > rule.maxLength) {
              errors[field] = `${field} must be at most ${rule.maxLength} characters`;
            }
          }
          else if (rule.type === 'enum') {
            if (!rule.values.includes(val)) {
              errors[field] = `${field} must be one of: ${rule.values.join(', ')}`;
            }
          }
          else if (rule.type === 'uuid') {
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(String(val))) {
              errors[field] = `${field} must be a valid UUID`;
            }
          }
        }
      }
    };

    checkGroup('body', req.body, schema.body);
    checkGroup('params', req.params, schema.params);
    checkGroup('query', req.query, schema.query);

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        errors
      });
    }

    next();
  };
};

module.exports = { validateSchema };
