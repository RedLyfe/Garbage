import pino, { type TransportSingleOptions } from "pino";

const isProd = process.env.NODE_ENV === "production";

const devTransport: TransportSingleOptions = {
  target: "pino-pretty",
  options: {
    colorize: true,
    singleLine: true,
  },
};

export const logger = pino({
  level: isProd ? "info" : "debug",
  ...(isProd ? {} : { transport: devTransport }),
});
