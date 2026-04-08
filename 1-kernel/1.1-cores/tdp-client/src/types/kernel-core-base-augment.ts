import type {KernelCoreTdpClientState} from './moduleState'

declare module '@impos2/kernel-core-base' {
  export interface RootState extends KernelCoreTdpClientState {}
}
