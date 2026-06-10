import axios from "axios";
import { NodeSSH } from "node-ssh";
import { AppError } from "../utils/appError.js";
import { messages } from "../utils/constant/messages.js";

// Fortigate REST API
const fortigateClient = axios.create({
    baseURL: `https://${process.env.FORTIGATE_HOST}/api/v2`,
    headers: { Authorization: `Bearer ${process.env.FORTIGATE_TOKEN}` },
    httpsAgent: new (await import("https")).Agent({ rejectUnauthorized: false })
});

export const blockIPFortigate = async (ip, comment = "LumiSec SOAR auto-block") => {
    try {
        await fortigateClient.post("/cmdb/firewall/address", {
            name: `LUMISEC-BLOCK-${ip}`,
            type: "ipmask",
            subnet: `${ip} 255.255.255.255`,
            comment
        });
        return { success: true, ip, method: "fortigate" };
    } catch (error) {
        // Fallback to pfSense via SSH
        return blockIPpfSense(ip);
    }
};

// pfSense via SSH fallback
export const blockIPpfSense = async (ip) => {
    const ssh = new NodeSSH();
    try {
        await ssh.connect({
            host: process.env.PFSENSE_HOST,
            username: process.env.PFSENSE_USER,
            password: process.env.PFSENSE_PASSWORD
        });
        await ssh.execCommand(`pfctl -t blocklist -T add ${ip}`);
        ssh.dispose();
        return { success: true, ip, method: "pfsense" };
    } catch (error) {
        throw new AppError(`${messages.integration.firewallError}: ${error.message}`, 502);
    }
};

export const unblockIP = async (ip) => {
    try {
        await fortigateClient.delete(`/cmdb/firewall/address/LUMISEC-BLOCK-${ip}`);
        return { success: true, ip, action: "unblocked" };
    } catch {
        const ssh = new NodeSSH();
        await ssh.connect({ host: process.env.PFSENSE_HOST, username: process.env.PFSENSE_USER, password: process.env.PFSENSE_PASSWORD });
        await ssh.execCommand(`pfctl -t blocklist -T delete ${ip}`);
        ssh.dispose();
        return { success: true, ip, action: "unblocked", method: "pfsense" };
    }
};
