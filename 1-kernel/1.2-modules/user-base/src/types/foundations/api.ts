import {User} from "../shared";

export interface LoginWithPasswordRequest {
    deviceId: string
    userName: string
    password: string
}

export interface SendVerifyCodeRequest {
    deviceId: string
    mobile: string
}

export interface LoginWithMobileRequest {
    deviceId: string
    mobile: string
    verifyCode: string
}
export interface LoginWithBarcodeRequest {
    deviceId: string
}

export interface LoginResponse {
    user: User
}
export interface LoginWithBarcodeResponse {
    url: string
}
export interface LogoutRequest {
    deviceId: string
}