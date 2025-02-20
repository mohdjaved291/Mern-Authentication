import mongoose from "mongoose";

declare global {
    namespace Express {
        interface Request {
            userId: unknown | mongoose.Types.ObjectId;  // Allow unknown type
            sessionId: unknown | mongoose.Types.ObjectId;
        }
    }
}

export { };