import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../../src/app.js";

let mongoServer;

export const initTestEnv = async () => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
};

export const clearTestDb = async () => {
    const collections = Object.values(mongoose.connection.collections);
    await Promise.all(collections.map((collection) => collection.deleteMany({})));
};

const closeTestQueues = async () => {
    try {
        const queuesModule = await import("../../src/utils/queue.js");
        await Promise.all(
            Object.values(queuesModule)
                .filter((entry) => entry && typeof entry.close === "function")
                .map((queue) => queue.close())
        );
    } catch {
        // queue module may not be loaded in every test file
    }
};

export const closeTestEnv = async () => {
    await closeTestQueues();
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    if (mongoServer) {
        await mongoServer.stop();
    }
};

export const buildTestApp = () => createApp();
