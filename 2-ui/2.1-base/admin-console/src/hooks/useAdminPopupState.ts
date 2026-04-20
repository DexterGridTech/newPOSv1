import {useCallback, useMemo, useState} from 'react'
import {useDispatch, useSelector} from 'react-redux'
import {selectAdminConsoleSelectedTab} from '../selectors'
import {adminConsoleStateActions} from '../features/slices'
import type {
    AdminConsoleScreen,
    AdminConsoleTab,
} from '../types'

export const useAdminPopupState = () => {
    const dispatch = useDispatch()
    const selectedTab = useSelector(selectAdminConsoleSelectedTab)
    const [screen, setScreen] = useState<AdminConsoleScreen>('login')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')

    const setSelectedTab = useCallback((tab: AdminConsoleTab) => {
        dispatch(adminConsoleStateActions.setSelectedTab(tab))
    }, [dispatch])

    return useMemo(() => ({
        screen,
        setScreen,
        selectedTab,
        setSelectedTab,
        password,
        setPassword,
        error,
        setError,
    }), [error, password, screen, selectedTab, setSelectedTab])
}
