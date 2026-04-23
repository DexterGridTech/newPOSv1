export * from './masterData'

import {organizationIamMasterDataSliceDescriptor} from './masterData'

export const organizationIamMasterDataStateSlices = [
    organizationIamMasterDataSliceDescriptor,
] as const

export const organizationIamMasterDataStateActions = {
    ...organizationIamMasterDataSliceDescriptor,
}
