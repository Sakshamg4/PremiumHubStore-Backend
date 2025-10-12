import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        error: { code: 'NO_TOKEN', message: 'Access denied. No token provided.' }
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user = await User.findById(decoded.userId).select('-passwordHash');
    
    if (!user || user.status !== 'active') {
      return res.status(401).json({
        error: { code: 'INVALID_TOKEN', message: 'Invalid token or user inactive.' }
      });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      error: { code: 'INVALID_TOKEN', message: 'Invalid token.' }
    });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Access denied.' }
      });
    }
    next();
  };
};
