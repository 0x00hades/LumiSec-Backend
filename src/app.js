import express from "express";
import { bootstrap } from "./bootstrap.js";

export const createApp = () => {
    const app = express();
    bootstrap(app, express);
    return app;
};
