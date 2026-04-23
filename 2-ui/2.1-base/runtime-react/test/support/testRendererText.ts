import type {ReactTestInstance} from 'react-test-renderer'

const collectText = (
    children: ReactTestInstance['children'],
    bucket: string[],
): void => {
    children.forEach(child => {
        if (typeof child === 'string') {
            bucket.push(child)
            return
        }
        collectText(child.children, bucket)
    })
}

export const textOf = (node: ReactTestInstance): string => {
    const bucket: string[] = []
    collectText(node.children, bucket)
    return bucket.join('')
}

