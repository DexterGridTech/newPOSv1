import {useMemo, useState} from 'react'
import {useSelector} from 'react-redux'
import {
    selectAdminConsoleRuntimeTab,
    selectAdminConsoleSelectedTab,
} from '../selectors'
import type {
    AdminConsoleScreen,
} from '../types'

export const useAdminPopupState = () => {
    const runtimeTab = useSelector(selectAdminConsoleRuntimeTab)
    const selectedTab = useSelector(selectAdminConsoleSelectedTab)
    const [screen, setScreen] = useState<AdminConsoleScreen>('login')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')

    return useMemo(() => ({
        screen,
        setScreen,
        runtimeTab,
        selectedTab,
        password,
        setPassword,
        error,
        setError,
    }), [error, password, runtimeTab, screen, selectedTab])
}
