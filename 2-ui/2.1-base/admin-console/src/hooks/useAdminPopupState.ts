import {useMemo, useState} from 'react'
import {useSelector} from 'react-redux'
import {selectAdminConsoleSelectedTab} from '../selectors'
import type {
    AdminConsoleScreen,
} from '../types'

export const useAdminPopupState = () => {
    const selectedTab = useSelector(selectAdminConsoleSelectedTab)
    const [screen, setScreen] = useState<AdminConsoleScreen>('login')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')

    return useMemo(() => ({
        screen,
        setScreen,
        selectedTab,
        password,
        setPassword,
        error,
        setError,
    }), [error, password, screen, selectedTab])
}
