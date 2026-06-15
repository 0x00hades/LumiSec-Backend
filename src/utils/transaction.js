import mongoose from "mongoose";

const transactionsEnabled = () =>
    process.env.MONGO_TRANSACTIONS === "true" || process.env.NODE_ENV === "production";

export const withTransaction = async (callback) => {
    if (!transactionsEnabled()) {
        return callback(null);
    }

    const session = await mongoose.startSession();

    try {
        let result;
        await session.withTransaction(async () => {
            result = await callback(session);
        });
        return result;
    } finally {
        await session.endSession();
    }
};
