import { APP_ORIGIN, JWT_REFRESH_SECRET, JWT_SECRET } from "../constants/env";
import { CONFLICT, INTERNAL_SERVER_ERROR, NOT_FOUND, TOO_MANY_REQUESTS, UNAUTHORIZED } from "../constants/http";
import VerificationCodeType from "../constants/verificationCodeType";
import SessionModel from "../models/session.model";
import UserModel from "../models/user.model"
import VerificationCodeModel from "../models/verificationCode.model";
import appAssert from "../utils/appAssert";
import { fiveMinutesAgo, ONE_DAY_MS, oneHourFromNow, oneYearFromNow, thirtydaysFromNow } from "../utils/date";
import jwt from "jsonwebtoken";
import { RefreshTokenPayload, refreshTokenSignOptions, signToken, verifyToken } from "../utils/jwt";
import { sendMail } from "../utils/sendMail";
import { getPasswordResetTemplate, getVerifyEmailTemplate } from "../utils/emailTemplates";
import { hashValue } from "../utils/bcrypt";

export type CreateAccountParams = {
    email: string,
    password: string,
    userAgent?: string
}

export const createAccount = async (data: CreateAccountParams) => {
    // verify existing user doesn't exist
    const existingUser = await UserModel.exists({
        email: data.email
    });

    appAssert(!existingUser, CONFLICT, "Email already in use");

    // if (existingUser) {
    //     throw new Error("User already exists");
    // }
    // create user
    const user = await UserModel.create({
        email: data.email,
        password: data.password
    });

    const userId = user._id;

    // create verification code
    const verificationCode = await VerificationCodeModel.create({
        userId,
        type: VerificationCodeType.EmailVerification,
        expiresAt: oneYearFromNow(),
    })

    const url = `${APP_ORIGIN}/email/verify/${verificationCode._id}`
    // send verification email
    const { error } = await sendMail({
        to: user.email,
        ...getVerifyEmailTemplate(url),
    });

    if (error) {
        console.log(error);
    }

    // create session
    const session = await SessionModel.create({
        userId,
        userAgent: data.userAgent,
    })

    // sign access token & refresh token
    const refreshToken = signToken(
        { sessionId: session._id },
        refreshTokenSignOptions
    );

    const accessToken = signToken({
        userId,
        sessionId: session._id,
    });
    // return user & tokens
    return {
        user: user.omitPassword(),
        accessToken,
        refreshToken
    };
};

type LoginParams = {
    email: string,
    password: string,
    userAgent?: string
};

export const loginUser = async ({ email, password, userAgent }: LoginParams) => {
    // get user by email
    const user = await UserModel.findOne({ email });
    appAssert(user, UNAUTHORIZED, "Invalid email or password");

    // validate password from the request 
    const isValid = await user.comparePassword(password);
    appAssert(isValid, UNAUTHORIZED, "Invalid email or password");

    const userId = user._id;
    // create a session 
    const session = await SessionModel.create({
        userId,
        userAgent
    });

    const sessionInfo = {
        sessionId: session._id,
    }

    // sign access token and refresh token 

    const refreshToken = signToken(sessionInfo, refreshTokenSignOptions);

    const accessToken = signToken(
        {
            ...sessionInfo,
            userId
        },
    )

    return {
        user: user.omitPassword(),
        accessToken,
        refreshToken
    };
};


export const refreshUserAccessToken = async (refreshToken: string) => {
    const {
        payload
    } = verifyToken<RefreshTokenPayload>(refreshToken, {
        secret: refreshTokenSignOptions.secret,
    });

    appAssert(payload, UNAUTHORIZED, "Invalid refresh token");

    const session = await SessionModel.findById(payload.sessionId);
    const now = Date.now();

    appAssert(session
        && session.expiresAt.getTime() > now,
        UNAUTHORIZED,
        "Session expired"
    );

    const sessionNeedsRefresh = session.expiresAt.getTime() - now <= ONE_DAY_MS;
    if (sessionNeedsRefresh) {
        session.expiresAt = thirtydaysFromNow();
        await session.save();
    }

    const newRefreshToken = sessionNeedsRefresh ? signToken(
        {
            sessionId: session._id
        },
        refreshTokenSignOptions
    ) : undefined;

    const accessToken = signToken({
        userId: session._id,
        sessionId: session._id,
    });

    return {
        accessToken,
        newRefreshToken,
    }
};

export const verifyEmail = async (code: string) => {
    const validCode = await VerificationCodeModel.findOne({
        _id: code,
        type: VerificationCodeType.EmailVerification,
        expiresAt: { $gt: new Date() },
    })
    appAssert(validCode, NOT_FOUND, "Invalid or expired verification code");

    const updatedUser = await UserModel.findByIdAndUpdate(
        validCode.userId, {
        verified: true,
    },
        { new: true }
    );

    appAssert(updatedUser, INTERNAL_SERVER_ERROR, "Failed to verify email");
    await validCode.deleteOne();

    return {
        user: updatedUser.omitPassword(),
    };
}

export const sendPasswordResetEmail = async (email: string) => {
    const user = await UserModel.findOne({ email });
    appAssert(user, NOT_FOUND, "User not found");

    const fiveMinAgo = fiveMinutesAgo();
    const count = await VerificationCodeModel.countDocuments({
        userId: user._id,
        type: VerificationCodeType.PasswordReset,
        createdAt: { $gt: fiveMinAgo },
    });

    appAssert(count <= 1, TOO_MANY_REQUESTS, "Too many requests, please try again later");

    const expiresAt = oneHourFromNow();
    const verificationCode = await VerificationCodeModel.create({
        userId: user._id,
        type: VerificationCodeType.PasswordReset,
        expiresAt
    });

    const url = `${APP_ORIGIN}/password/reset?code=${verificationCode._id}&exp=${expiresAt.getTime()}`;

    const { data, error } = await sendMail({
        to: user.email,
        ...getPasswordResetTemplate(url),
    });

    appAssert(
        data?.id,
        INTERNAL_SERVER_ERROR,
        `${error?.name} - ${error?.message}`
    )

    return {
        url,
        email: data?.id,
    }
}

type ResetPasswordParams = {
    password: string;
    verificationCode: string;
};

export const resetPassword = async (
    { password, verificationCode }: ResetPasswordParams
) => {
    const validCode = await VerificationCodeModel.findOne({
        _id: verificationCode,
        type: VerificationCodeType.PasswordReset,
        expiresAt: { $gt: new Date() },
    });

    appAssert(validCode, NOT_FOUND, "Invalid or expired verification code");

    const updatedUser = await UserModel.findByIdAndUpdate(validCode.userId, {
        password: await hashValue(password),
    }, { new: true });
    appAssert(updatedUser, INTERNAL_SERVER_ERROR, "Failed to reset password");

    await validCode.deleteOne();

    await SessionModel.deleteMany({
        userId: updatedUser._id,
    });

    return {
        user: updatedUser.omitPassword(),
    };
}