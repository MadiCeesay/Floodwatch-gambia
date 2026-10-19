import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
export function authenticate(env, roles = ['admin']) {
  return async (req, _res, next) => {
    const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
    if (!token) throw new ApiError(401, 'Administrator authentication required');
    let claims;
    try { claims = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'floodwatch', audience: 'floodwatch-admin' }); }
    catch { throw new ApiError(401, 'Invalid or expired token'); }
    if (typeof claims.sub !== 'string' || !/^[a-f\d]{24}$/i.test(claims.sub)) throw new ApiError(401, 'Invalid token');
    const user = await User.findById(claims.sub);
    if (!user?.isActive) throw new ApiError(401, 'Account unavailable');
    if (!roles.includes(user.role)) throw new ApiError(403, 'Access denied');
    req.user = user;
    next();
  };
}
