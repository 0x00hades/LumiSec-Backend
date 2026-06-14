import { AppError } from "../utils/appError.js";
import { messages } from "../utils/constant/messages.js";

export const isValid = (schema, source) => {
    return (req, res, next) => {
        let data;
        if (source === "query") data = req.query;
        else if (source === "params") data = req.params;
        else if (source === "body") data = req.body;
        else data = { ...req.body, ...req.params, ...req.query };

        const { error } = schema.validate(data, { abortEarly: false });
        if (error) {
            const msg = error.details.map((d) => d.message).join(", ");
            return next(new AppError(`${messages.general.validationError}: ${msg}`, 422));
        }
        next();
    };
};
