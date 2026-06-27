import bcrypt from "bcrypt";
import { User } from "../../../database/index.js";
import { AppError } from "../../utils/appError.js";
import { generateToken } from "../../utils/token.js";
import { successResponse } from "../../utils/apiResponse.js";
import { messages } from "../../utils/constant/messages.js";

export const signup = async (req, res, next) => {
    const { name, email, password, role, department } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) return next(new AppError(messages.user.alreadyExists, 409));

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, password: hashedPassword, role, department });

    const token = generateToken({ _id: user._id, role: user.role });

    return successResponse(res, {
        message: messages.user.createdSuccessfully,
        data: { user: { _id: user._id, name: user.name, email: user.email, role: user.role }, token },
        statusCode: 201
    });
};

export const login = async (req, res, next) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return next(new AppError(messages.auth.invalidCredentials, 401));

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return next(new AppError(messages.auth.invalidCredentials, 401));

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken({ _id: user._id, role: user.role });

    return successResponse(res, {
        message: messages.auth.loginSuccess,
        data: { user: { _id: user._id, name: user.name, email: user.email, role: user.role }, token }
    });
};

export const getProfile = async (req, res, next) => {
    return successResponse(res, { message: "Profile fetched", data: req.authUser });
};

export const updateProfile = async (req, res, next) => {
    const { name, password, currentPassword } = req.body;
    const user = await User.findById(req.authUser._id);
    if (!user) return next(new AppError(messages.user.notFound, 404));

    if (name !== undefined) {
        user.name = name.trim();
    }

    if (password) {
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return next(new AppError("Current password is incorrect", 401));
        user.password = await bcrypt.hash(password, 12);
    }

    await user.save();

    const sanitized = await User.findById(user._id).select("-password");
    return successResponse(res, {
        message: messages.user.updatedSuccessfully,
        data: sanitized
    });
};
