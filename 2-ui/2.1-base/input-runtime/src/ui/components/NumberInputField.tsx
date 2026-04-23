import React from 'react'
import {InputField, type InputFieldProps} from './InputField'

export const NumberInputField: React.FC<Omit<InputFieldProps, 'mode'>> = props => (
    <InputField {...props} mode="system-number" />
)
