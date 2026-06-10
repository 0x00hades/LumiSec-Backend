import axios from "axios";
import { AppError } from "../utils/appError.js";
import { messages } from "../utils/constant/messages.js";

// WinRM uses HTTP Basic over port 5985 (HTTP) or 5986 (HTTPS)
const winrmRequest = async (command) => {
    const host = process.env.WINDOWS_VM_HOST;
    const port = process.env.WINRM_PORT || 5985;
    const user = process.env.WINDOWS_VM_USER;
    const pass = process.env.WINDOWS_VM_PASSWORD;

    const body = `
        <s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
                    xmlns:wsman="http://schemas.dmtf.org/wbem/wsman/1/wsman.xsd">
          <s:Body>
            <rsp:CommandLine xmlns:rsp="http://schemas.microsoft.com/wbem/wsman/1/windows/shell">
              <rsp:Command>${command}</rsp:Command>
            </rsp:CommandLine>
          </s:Body>
        </s:Envelope>`;

    try {
        const response = await axios.post(
            `http://${host}:${port}/wsman`,
            body,
            { auth: { username: user, password: pass }, headers: { "Content-Type": "application/soap+xml" } }
        );
        return response.data;
    } catch (error) {
        throw new AppError(`${messages.integration.vmError}: ${error.message}`, 502);
    }
};

export const runWindowsCommand = async (command) => {
    return winrmRequest(command);
};

export const getWindowsLogs = async () => {
    return winrmRequest("Get-EventLog -LogName Security -Newest 100 | ConvertTo-Json");
};

export const isolateWindowsHost = async () => {
    return winrmRequest("netsh advfirewall set allprofiles firewallpolicy blockinbound,blockoutbound");
};
