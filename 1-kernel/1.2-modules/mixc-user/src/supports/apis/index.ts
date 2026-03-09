import {Api, HttpMethod} from "@impos2/kernel-core-base";
import {SERVER_NAME_MIXC_USER_API} from "@impos2/kernel-server-config";
import {
    LoginResponse, LoginWithBarcodeRequest, LoginWithBarcodeResponse,
    LoginWithMobileRequest,
    LoginWithPasswordRequest, LogoutRequest,
    SendVerifyCodeRequest
} from "../../types/foundations/api";

export const kernelMixcUserApis = {
    loginWithPassword: new Api<LoginWithPasswordRequest, LoginResponse>(
        SERVER_NAME_MIXC_USER_API,
        '/api/login/withPassword',
        HttpMethod.POST
    ),
    sendVerifyCode: new Api<SendVerifyCodeRequest, any>(
        SERVER_NAME_MIXC_USER_API,
        '/api/login/sendVerifyCode',
        HttpMethod.POST
    ),
    loginWithMobile: new Api<LoginWithMobileRequest, LoginResponse>(
        SERVER_NAME_MIXC_USER_API,
        '/api/login/loginWithMobile',
        HttpMethod.POST
    ),
    loginWithBarcode: new Api<LoginWithBarcodeRequest, LoginWithBarcodeResponse>(
        SERVER_NAME_MIXC_USER_API,
        '/api/login/loginWithBarcode',
        HttpMethod.POST
    ),
    logout: new Api<LogoutRequest, any>(
        SERVER_NAME_MIXC_USER_API,
        '/api/login/logout',
        HttpMethod.POST
    )
};