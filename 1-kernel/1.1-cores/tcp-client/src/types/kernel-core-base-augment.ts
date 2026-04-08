import type {KernelCoreTcpClientState} from './moduleState'

declare module '@impos2/kernel-core-base' {
  export interface RootState extends KernelCoreTcpClientState {}
}
