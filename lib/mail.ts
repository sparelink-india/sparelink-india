import net from "node:net";
import tls from "node:tls";

import { PUBLIC_SUPPORT_INBOX } from "@/lib/business-contacts";

export type SupportMailPayload = {
  name: string;
  mobile: string;
  email: string;
  orderId: string;
  subject: string;
  message: string;
  submittedAt: string;
};

function readOptional(name: string): string | undefined {
  const value = process.env[name];
  if (!value || !value.trim()) return undefined;
  return value.trim();
}

export function getSupportMailConfig() {
  const host = readOptional("SMTP_HOST");
  const portRaw = readOptional("SMTP_PORT");
  const user = readOptional("SMTP_USER");
  const password = readOptional("SMTP_PASSWORD");
  const to = readOptional("SUPPORT_EMAIL_TO") || PUBLIC_SUPPORT_INBOX;
  const missing: string[] = [];
  if (!host) missing.push("SMTP_HOST");
  if (!portRaw) missing.push("SMTP_PORT");
  if (!user) missing.push("SMTP_USER");
  if (!password) missing.push("SMTP_PASSWORD");
  return {
    host,
    port: portRaw ? Number(portRaw) : undefined,
    user,
    password,
    to,
    from: user,
    missing,
    configured: missing.length === 0,
  };
}

function encodeSubject(subject: string): string {
  return subject.replace(/[\r\n]+/g, " ").slice(0, 180);
}

async function smtpCommand(
  socket: net.Socket,
  command?: string,
): Promise<string> {
  if (command) {
    socket.write(`${command}\r\n`);
  }
  return await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("SMTP timeout")), 15000);
    const chunks: Buffer[] = [];
    const onData = (chunk: Buffer) => {
      chunks.push(chunk);
      const text = Buffer.concat(chunks).toString("utf8");
      const lines = text.replace(/\r/g, "").trim().split("\n");
      const last = lines[lines.length - 1] || "";
      if (/^\d{3} /.test(last)) {
        clearTimeout(timeout);
        socket.off("data", onData);
        resolve(text);
      }
    };
    socket.on("data", onData);
    socket.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

async function sendRawSmtp(options: {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
  to: string;
  raw: string;
}): Promise<void> {
  const connectPlain = options.port !== 465;
  const socket: net.Socket = await new Promise((resolve, reject) => {
    const onError = (error: Error) => reject(error);
    if (!connectPlain) {
      const secure = tls.connect(
        { host: options.host, port: options.port, servername: options.host },
        () => resolve(secure),
      );
      secure.once("error", onError);
      return;
    }
    const plain = net.connect({ host: options.host, port: options.port }, () =>
      resolve(plain),
    );
    plain.once("error", onError);
  });

  try {
    await smtpCommand(socket);
    await smtpCommand(socket, `EHLO sparelink-india`);
    if (connectPlain) {
      const startTls = await smtpCommand(socket, "STARTTLS");
      if (!startTls.startsWith("220")) {
        throw new Error("SMTP STARTTLS was rejected");
      }
      const upgraded = await new Promise<tls.TLSSocket>((resolve, reject) => {
        const secure = tls.connect(
          { socket, servername: options.host },
          () => resolve(secure),
        );
        secure.once("error", reject);
      });
      await smtpCommand(upgraded, `EHLO sparelink-india`);
      await authenticateAndSend(upgraded, options);
      upgraded.end();
      return;
    }
    await authenticateAndSend(socket, options);
  } finally {
    socket.end();
  }
}

async function authenticateAndSend(
  socket: net.Socket,
  options: {
    user: string;
    password: string;
    from: string;
    to: string;
    raw: string;
  },
) {
  const auth = await smtpCommand(socket, "AUTH LOGIN");
  if (!auth.startsWith("334")) throw new Error("SMTP AUTH was rejected");
  const userReply = await smtpCommand(socket, Buffer.from(options.user).toString("base64"));
  if (!userReply.startsWith("334")) throw new Error("SMTP username was rejected");
  const passReply = await smtpCommand(socket, Buffer.from(options.password).toString("base64"));
  if (!passReply.startsWith("235")) throw new Error("SMTP authentication failed");
  const mailFrom = await smtpCommand(socket, `MAIL FROM:<${options.from}>`);
  if (!mailFrom.startsWith("250")) throw new Error("SMTP MAIL FROM was rejected");
  const rcpt = await smtpCommand(socket, `RCPT TO:<${options.to}>`);
  if (!rcpt.startsWith("250")) throw new Error("SMTP RCPT TO was rejected");
  const data = await smtpCommand(socket, "DATA");
  if (!data.startsWith("354")) throw new Error("SMTP DATA was rejected");
  const done = await smtpCommand(socket, `${options.raw}\r\n.`);
  if (!done.startsWith("250")) throw new Error("SMTP message was rejected");
  await smtpCommand(socket, "QUIT").catch(() => undefined);
}

export async function sendSupportRequestEmail(payload: SupportMailPayload): Promise<void> {
  const config = getSupportMailConfig();
  if (!config.configured || !config.host || !config.port || !config.user || !config.password || !config.from || !config.to) {
    throw new Error("Support email is not configured.");
  }

  const subject = encodeSubject(`[Sparelink Support] ${payload.subject}`);
  const body = [
    "Sparelink India support request",
    `Timestamp: ${payload.submittedAt}`,
    `Name: ${payload.name}`,
    `Mobile: ${payload.mobile || "(not provided)"}`,
    `Email: ${payload.email || "(not provided)"}`,
    `Order ID: ${payload.orderId || "(not provided)"}`,
    `Subject: ${payload.subject}`,
    "",
    payload.message,
  ].join("\r\n");

  const raw = [
    `From: ${config.from}`,
    `To: ${config.to}`,
    payload.email ? `Reply-To: ${payload.email}` : null,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    body.replace(/^\./gm, ".."),
  ]
    .filter((line) => line !== null)
    .join("\r\n");

  await sendRawSmtp({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    from: config.from,
    to: config.to,
    raw,
  });
}
