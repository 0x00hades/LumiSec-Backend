import { NodeSSH } from "node-ssh";
import { AppError } from "../utils/appError.js";
import { messages } from "../utils/constant/messages.js";

const connect = async () => {
    const ssh = new NodeSSH();
    await ssh.connect({
        host: process.env.LINUX_VM_HOST,
        username: process.env.LINUX_VM_USER,
        privateKeyPath: process.env.LINUX_VM_KEY_PATH
    });
    return ssh;
};

export const runCommand = async (command) => {
    let ssh;
    try {
        ssh = await connect();
        const result = await ssh.execCommand(command);
        return { stdout: result.stdout, stderr: result.stderr };
    } catch (error) {
        throw new AppError(`${messages.integration.vmError}: ${error.message}`, 502);
    } finally {
        if (ssh) ssh.dispose();
    }
};

export const getLogs = async (logPath = "/var/log/syslog", lines = 100) => {
    return runCommand(`tail -n ${lines} ${logPath}`);
};

export const isolateHost = async () => {
    return runCommand("iptables -I INPUT -j DROP && iptables -I OUTPUT -j DROP");
};

export const restoreHost = async () => {
    return runCommand("iptables -D INPUT -j DROP && iptables -D OUTPUT -j DROP");
};
