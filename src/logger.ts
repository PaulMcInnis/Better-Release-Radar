import winston from "winston";
import { options } from "./cli";

export const logger = winston.createLogger({
  level: options.logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: "MM-DD HH:mm" }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: options.logFile }),
  ],
});
