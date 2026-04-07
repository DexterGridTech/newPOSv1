import {SERVER_NAME_MIXC_USER_API} from '@impos2/kernel-server-config'
import {
  defineHttpEndpoint,
  defineHttpServiceModule,
  getCommunicationServersFromStoreEntry,
  HttpRuntime,
  typed,
} from '@impos2/kernel-core-communication'
import {moduleName} from '../moduleName'
import type {
  LoginResponse,
  LoginWithBarcodeRequest,
  LoginWithBarcodeResponse,
  LoginWithMobileRequest,
  LoginWithPasswordRequest,
  LogoutRequest,
  SendVerifyCodeRequest,
} from '../types/foundations/api'

const runtime = new HttpRuntime({
  serverConfigProvider: getCommunicationServersFromStoreEntry,
  unwrapEnvelope: true,
})

const endpointNamePrefix = `${moduleName}.auth`

const loginWithPasswordEndpoint = defineHttpEndpoint<void, void, LoginWithPasswordRequest, LoginResponse>({
  name: `${endpointNamePrefix}.loginWithPassword`,
  serverName: SERVER_NAME_MIXC_USER_API,
  method: 'POST',
  pathTemplate: '/api/login/withPassword',
  request: {
    body: typed<LoginWithPasswordRequest>(),
  },
  response: typed<LoginResponse>(),
})

const sendVerifyCodeEndpoint = defineHttpEndpoint<void, void, SendVerifyCodeRequest, Record<string, never>>({
  name: `${endpointNamePrefix}.sendVerifyCode`,
  serverName: SERVER_NAME_MIXC_USER_API,
  method: 'POST',
  pathTemplate: '/api/login/sendVerifyCode',
  request: {
    body: typed<SendVerifyCodeRequest>(),
  },
  response: typed<Record<string, never>>(),
})

const loginWithMobileEndpoint = defineHttpEndpoint<void, void, LoginWithMobileRequest, LoginResponse>({
  name: `${endpointNamePrefix}.loginWithMobile`,
  serverName: SERVER_NAME_MIXC_USER_API,
  method: 'POST',
  pathTemplate: '/api/login/loginWithMobile',
  request: {
    body: typed<LoginWithMobileRequest>(),
  },
  response: typed<LoginResponse>(),
})

const loginWithBarcodeEndpoint = defineHttpEndpoint<void, void, LoginWithBarcodeRequest, LoginWithBarcodeResponse>({
  name: `${endpointNamePrefix}.loginWithBarcode`,
  serverName: SERVER_NAME_MIXC_USER_API,
  method: 'POST',
  pathTemplate: '/api/login/loginWithBarcode',
  request: {
    body: typed<LoginWithBarcodeRequest>(),
  },
  response: typed<LoginWithBarcodeResponse>(),
})

const logoutEndpoint = defineHttpEndpoint<void, void, LogoutRequest, Record<string, never>>({
  name: `${endpointNamePrefix}.logout`,
  serverName: SERVER_NAME_MIXC_USER_API,
  method: 'POST',
  pathTemplate: '/api/login/logout',
  request: {
    body: typed<LogoutRequest>(),
  },
  response: typed<Record<string, never>>(),
})

export interface KernelMixcUserLoginHttpServices {
  auth: {
    loginWithPassword(request: LoginWithPasswordRequest): Promise<LoginResponse>
    sendVerifyCode(request: SendVerifyCodeRequest): Promise<Record<string, never>>
    loginWithMobile(request: LoginWithMobileRequest): Promise<LoginResponse>
    loginWithBarcode(request: LoginWithBarcodeRequest): Promise<LoginWithBarcodeResponse>
    logout(request: LogoutRequest): Promise<Record<string, never>>
  }
}

export const kernelMixcUserLoginHttpServiceModule = defineHttpServiceModule<KernelMixcUserLoginHttpServices>(moduleName, {
  auth: {
    loginWithPassword(request) {
      return runtime.call(loginWithPasswordEndpoint, {body: request})
    },
    sendVerifyCode(request) {
      return runtime.call(sendVerifyCodeEndpoint, {body: request})
    },
    loginWithMobile(request) {
      return runtime.call(loginWithMobileEndpoint, {body: request})
    },
    loginWithBarcode(request) {
      return runtime.call(loginWithBarcodeEndpoint, {body: request})
    },
    logout(request) {
      return runtime.call(logoutEndpoint, {body: request})
    },
  },
})

export const kernelMixcUserLoginHttpServices = kernelMixcUserLoginHttpServiceModule.services
