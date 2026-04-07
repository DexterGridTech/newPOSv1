import {moduleName} from '../../moduleName'
import {
  Actor,
  getDeviceId,
  getProduction,
  LOG_TAGS,
  logger,
  storeEntry,
} from '@impos2/kernel-core-base'
import {normalizeCommunicationError} from '@impos2/kernel-core-communication'
import {kernelMixcUserLoginCommands} from '../commands'
import {kernelMixcUserLoginHttpServices} from '../../supports'
import {userActions} from '../slices/user'
import type {
  LoginWithBarcodeRequest,
  LoginWithMobileRequest,
  LoginWithPasswordRequest,
  LogoutRequest,
  SendVerifyCodeRequest,
} from '../../types/foundations/api'
import type {User} from '../../types'

function createLocalBossUser(): User {
  return {
    id: '123',
    userName: 'boss',
    name: '老板',
    mobile: '13800000000',
    userRoles: [
      {key: 'boss', name: '老板'},
      {key: 'employee', name: '员工'},
      {key: 'finance', name: '财务'},
    ],
  }
}

function tryLocalBossLogin(userName: string, password: string): User | undefined {
  if (getProduction()) {
    return undefined
  }
  if (userName === 'boss' && password === 'boss') {
    return createLocalBossUser()
  }
  return undefined
}

export class UserActor extends Actor {
  loginWithPassword = Actor.defineCommandHandler(
    kernelMixcUserLoginCommands.loginWithPassword,
    async (command): Promise<Record<string, any>> => {
      logger.log([moduleName, LOG_TAGS.Actor, 'UserActor'], 'login With Password')

      const localUser = tryLocalBossLogin(command.payload.userName, command.payload.password)
      if (localUser) {
        storeEntry.dispatchAction(userActions.setUser(localUser))
        kernelMixcUserLoginCommands.loginSuccess().executeFromParent(command)
        return {user: localUser}
      }

      const request: LoginWithPasswordRequest = {
        userName: command.payload.userName,
        password: command.payload.password,
        deviceId: getDeviceId(),
      }

      try {
        const result = await kernelMixcUserLoginHttpServices.auth.loginWithPassword(request)
        storeEntry.dispatchAction(userActions.setUser(result.user))
        kernelMixcUserLoginCommands.loginSuccess().executeFromParent(command)
        return {user: result.user}
      } catch (error) {
        throw normalizeCommunicationError(error)
      }
    },
  )

  sendVerifyCode = Actor.defineCommandHandler(
    kernelMixcUserLoginCommands.sendVerifyCode,
    async (command): Promise<Record<string, any>> => {
      logger.log([moduleName, LOG_TAGS.Actor, 'UserActor'], 'send Verify Code')
      const request: SendVerifyCodeRequest = {
        mobile: command.payload.mobile,
        deviceId: getDeviceId(),
      }

      try {
        await kernelMixcUserLoginHttpServices.auth.sendVerifyCode(request)
        return {}
      } catch (error) {
        throw normalizeCommunicationError(error)
      }
    },
  )

  loginWithMobile = Actor.defineCommandHandler(
    kernelMixcUserLoginCommands.loginWithMobile,
    async (command): Promise<Record<string, any>> => {
      logger.log([moduleName, LOG_TAGS.Actor, 'UserActor'], 'login With Mobile')
      const request: LoginWithMobileRequest = {
        mobile: command.payload.mobile,
        verifyCode: command.payload.verifyCode,
        deviceId: getDeviceId(),
      }

      try {
        const result = await kernelMixcUserLoginHttpServices.auth.loginWithMobile(request)
        storeEntry.dispatchAction(userActions.setUser(result.user))
        kernelMixcUserLoginCommands.loginSuccess().executeFromParent(command)
        return {user: result.user}
      } catch (error) {
        throw normalizeCommunicationError(error)
      }
    },
  )

  loginWithBarcode = Actor.defineCommandHandler(
    kernelMixcUserLoginCommands.loginWithBarcode,
    async (_command): Promise<Record<string, any>> => {
      logger.log([moduleName, LOG_TAGS.Actor, 'UserActor'], 'login With Barcode')
      const request: LoginWithBarcodeRequest = {
        deviceId: getDeviceId(),
      }

      try {
        const result = await kernelMixcUserLoginHttpServices.auth.loginWithBarcode(request)
        return {url: result.url}
      } catch (error) {
        throw normalizeCommunicationError(error)
      }
    },
  )

  logout = Actor.defineCommandHandler(
    kernelMixcUserLoginCommands.logout,
    async (_command): Promise<Record<string, any>> => {
      logger.log([moduleName, LOG_TAGS.Actor, 'UserActor'], 'logout')
      const request: LogoutRequest = {
        deviceId: getDeviceId(),
      }

      try {
        await kernelMixcUserLoginHttpServices.auth.logout(request)
        storeEntry.dispatchAction(userActions.clearUser())
        return {}
      } catch (error) {
        throw normalizeCommunicationError(error)
      }
    },
  )

  updateUserState = Actor.defineCommandHandler(
    kernelMixcUserLoginCommands.updateUserState,
    async (): Promise<Record<string, any>> => {
      logger.log([moduleName, LOG_TAGS.Actor, 'UserActor'], 'updateUserState')
      return {}
    },
  )
}
