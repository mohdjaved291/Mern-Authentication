import assert from "node:assert";
import AppError from "./AppError";
import { HTTPStatusCode } from "../constants/http";
import AppErrorCode from "../constants/appErrorCodes";

type AppAssert = (
    condition: any,
    httpStatusCode: HTTPStatusCode,
    message: string,
    appErrorCode?: AppErrorCode
) => asserts condition;

const appAssert: AppAssert = (
    condition,
    httpStatusCode,
    message,
    appErrorCode,
) => assert(condition, new AppError(httpStatusCode, message, appErrorCode));

export default appAssert;