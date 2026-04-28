import { z } from 'zod';

export const phoneSchema = z.string().regex(/^\d{10}$/, 'Phone number must be exactly 10 digits');
export const otpSchema = z.string().length(6, 'OTP must be 6 digits').regex(/^\d+$/, 'OTP must be numeric');
export const emailSchema = z.string().email('Invalid email address');

export const registerSchema = z.object({
    name: z.string().min(2, 'Name is too short').max(50, 'Name is too long'),
    phone: phoneSchema,
    email: emailSchema,
    role: z.enum(['citizen', 'doctor']),
    otp: z.string().min(4, 'OTP required'),
    qualification: z.string().optional(),
    specialization: z.string().optional(),
    registrationNumber: z.string().optional(),
    abhaId: z.string().optional(),
});

export const loginSchema = z.object({
    phone: z.string().min(4, 'Identifier too short'), // Supports Phone, Email, or ABHA ID
    otp: z.string().min(4, 'OTP required'),
});

export const sendOtpSchema = z.object({
    phone: z.string().min(4, 'Identifier too short'), // Supports Phone, Email, or ABHA ID
});
