import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Business name is required').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(255),
  password: z.string().min(1, 'Password is required').max(200),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
