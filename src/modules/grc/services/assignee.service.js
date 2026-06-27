import { User } from "../../../../database/index.js";
import { userStatus } from "../../../utils/constant/enums.js";

export const listAssignees = async (query = {}) => {
    const limit = Math.min(Number(query.limit) || 100, 100);

    const data = await User.find({ status: userStatus.ACTIVE })
        .select("name email role department")
        .sort({ name: 1 })
        .limit(limit);

    return data;
};
