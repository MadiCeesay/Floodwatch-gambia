import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { authenticate } from '../middleware/auth.js';

const schema = z.object({ email: z.string().trim().toLowerCase().pipe(z.email()), password: z.string().min(1).max(200) }).strict();
// Equal-cost comparison for nonexistent accounts reduces account enumeration timing.
const dummyHash = bcrypt.hashSync('unused-account-comparison-value', 12);
export function authRoutes(env, limiter) {
  const router = Router();
  router.post('/login', limiter, async (req, res) => {
    const { email, password } = schema.parse(req.body);
    const user = await User.findOne({ email }).select('+password');
    const valid = await bcrypt.compare(password, user?.password || dummyHash);
    if (!valid || !user?.isActive) throw new ApiError(401, 'Invalid email or password');
    const token = jwt.sign({}, env.JWT_SECRET, { algorithm: 'HS256', subject: String(user._id), expiresIn: env.JWT_EXPIRES_IN, issuer: 'floodwatch', audience: 'floodwatch-admin' });
    res.json({ data: { token, tokenType: 'Bearer', user: { id: user.id, name: user.name, role: user.role } } });
  });
  router.get('/me', authenticate(env), (req, res) => res.json({ data: { id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role } }));
  return router;
}
