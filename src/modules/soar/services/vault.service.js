import { CredentialVault } from "../../../../database/index.js";
import { AppError } from "../../../utils/appError.js";
import { messages } from "../../../utils/constant/messages.js";
import { entityType, auditAction } from "../../../utils/constant/enums.js";
import { parsePagination, buildTextSearch } from "../../../utils/pagination.js";
import { auditCreate, auditUpdate, recordAudit } from "../../../utils/auditLogger.js";
import { encryptSecret, decryptSecret, maskSecret } from "../helpers/vaultCrypto.js";

const toPublicVault = (vault) => ({
    _id: vault._id,
    name: vault.name,
    description: vault.description,
    createdBy: vault.createdBy,
    updatedBy: vault.updatedBy,
    createdAt: vault.createdAt,
    updatedAt: vault.updatedAt,
    hasSecret: Boolean(vault.encryptedValue)
});

export const createVaultEntry = async (data, user) => {
    const { plaintext, ...meta } = data;

    if (!plaintext) throw new AppError("Secret value is required", 400);

    const existing = await CredentialVault.findOne({ name: meta.name });
    if (existing) throw new AppError("Vault entry name already exists", 409);

    const encrypted = encryptSecret(plaintext);

    const vault = await CredentialVault.create({
        ...meta,
        ...encrypted,
        createdBy: user._id
    });

    await auditCreate(user, entityType.VAULT, {
        _id: vault._id,
        toObject: () => toPublicVault(vault)
    });

    return toPublicVault(vault);
};

export const listVaultEntries = async (query) => {
    const { page, limit, skip, sort } = parsePagination(query);
    const searchFilter = buildTextSearch(query.search, ["name", "description"]);
    const filter = Object.keys(searchFilter).length ? searchFilter : {};

    const [rows, total] = await Promise.all([
        CredentialVault.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .populate("createdBy", "name email")
            .populate("updatedBy", "name email")
            .select("-encryptedValue -iv -authTag"),
        CredentialVault.countDocuments(filter)
    ]);

    const data = rows.map(toPublicVault);
    return { data, page, limit, total };
};

export const getVaultById = async (id) => {
    const vault = await CredentialVault.findById(id)
        .populate("createdBy", "name email")
        .populate("updatedBy", "name email")
        .select("-encryptedValue -iv -authTag");

    if (!vault) throw new AppError(messages.general.notFound, 404);
    return toPublicVault(vault);
};

export const getVaultSecret = async (id) => {
    const vault = await CredentialVault.findById(id);
    if (!vault) throw new AppError(messages.general.notFound, 404);

    const plaintext = decryptSecret({
        encryptedValue: vault.encryptedValue,
        iv: vault.iv,
        authTag: vault.authTag
    });

    return {
        ...toPublicVault(vault),
        secret: plaintext,
        masked: maskSecret(plaintext)
    };
};

export const updateVaultEntry = async (id, updates, user) => {
    const vault = await CredentialVault.findById(id);
    if (!vault) throw new AppError(messages.general.notFound, 404);

    const { plaintext, ...meta } = updates;
    const oldValue = toPublicVault(vault);

    if (meta.name && meta.name !== vault.name) {
        const duplicate = await CredentialVault.findOne({ name: meta.name, _id: { $ne: id } });
        if (duplicate) throw new AppError("Vault entry name already exists", 409);
    }

    Object.assign(vault, meta);
    vault.updatedBy = user._id;

    if (plaintext) {
        const encrypted = encryptSecret(plaintext);
        vault.encryptedValue = encrypted.encryptedValue;
        vault.iv = encrypted.iv;
        vault.authTag = encrypted.authTag;
    }

    await vault.save();

    await auditUpdate(user, entityType.VAULT, vault._id, oldValue, toPublicVault(vault));
    return toPublicVault(vault);
};

export const softDeleteVaultEntry = async (id, user) => {
    const vault = await CredentialVault.findById(id);
    if (!vault) throw new AppError(messages.general.notFound, 404);

    vault.deletedAt = new Date();
    await vault.save();

    await recordAudit({
        user,
        action: auditAction.DELETE,
        entityType: entityType.VAULT,
        entityId: vault._id,
        oldValue: toPublicVault(vault),
        newValue: { deletedAt: vault.deletedAt }
    });

    return toPublicVault(vault);
};
