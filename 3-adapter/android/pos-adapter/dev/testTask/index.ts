import {readBarCodeFromCamera} from './readBarCodeFromCamera'
import {readBarCodeFromScanner} from './readBarCodeFromScanner'
import {readFileFromSystemFileBrowser} from './readFileFromSystemFileBrowser'
import {TaskDefinition} from '@impos2/kernel-core-task'

export const TEST_TASK_DEFINITIONS: TaskDefinition[] = [
    readBarCodeFromCamera,
    readBarCodeFromScanner,
    readFileFromSystemFileBrowser,
]

export {readBarCodeFromCamera, readBarCodeFromScanner, readFileFromSystemFileBrowser}
