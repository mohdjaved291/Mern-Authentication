import dotenv from 'dotenv';

dotenv.config();

const getEnv = (key: string, defaultValue?: string): string => {
    const value = process.env[key] || defaultValue;

    if (value === undefined) {
        throw new Error(`Missing Environment variable ${key}`);
    }

    return value;
}

export const MONGO_URI = getEnv("MONGO_URI");
export const NODE_ENV = getEnv("NODE_ENV", "development");
export const PORT = getEnv("PORT", "4004");
export const APP_ORIGIN = NODE_ENV === 'development'
    ? 'https://mern-authentication-il9y.onrender.com'  // Development frontend URL
    : getEnv("APP_ORIGIN");    // Production frontend URL
export const API_ORIGIN = NODE_ENV === 'development'
    ? 'https://mern-authentication-yty2.onrender.com'  // Development backend URL
    : getEnv("API_ORIGIN");
export const JWT_SECRET = getEnv("JWT_SECRET");
export const JWT_REFRESH_SECRET = getEnv("JWT_REFRESH_SECRET");
export const EMAIL_SENDER = getEnv("EMAIL_SENDER");
export const RESEND_API_KEY = getEnv("RESEND_API_KEY");

export { getEnv };