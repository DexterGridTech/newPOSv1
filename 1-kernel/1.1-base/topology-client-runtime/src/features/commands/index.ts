/**
 * Command definitions for this package belong here.
 */
import {moduleName} from '../../moduleName'

export const topologyClientCommandNames = {
    setInstanceMode: `${moduleName}.set-instance-mode`,
    setDisplayMode: `${moduleName}.set-display-mode`,
    setEnableSlave: `${moduleName}.set-enable-slave`,
    setMasterInfo: `${moduleName}.set-master-info`,
    clearMasterInfo: `${moduleName}.clear-master-info`,
    refreshTopologyContext: `${moduleName}.refresh-topology-context`,
    startTopologyConnection: `${moduleName}.start-topology-connection`,
    stopTopologyConnection: `${moduleName}.stop-topology-connection`,
    restartTopologyConnection: `${moduleName}.restart-topology-connection`,
    resumeTopologySession: `${moduleName}.resume-topology-session`,
    dispatchRemoteCommand: `${moduleName}.dispatch-remote-command`,
} as const
