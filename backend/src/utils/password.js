import bcrypt from 'bcrypt';
import { env } from '../config/env.js';

export const hashPassword   = (plain)        => bcrypt.hash(plain, env.bcrypt.rounds);
export const verifyPassword = (plain, hash)  => bcrypt.compare(plain, hash);