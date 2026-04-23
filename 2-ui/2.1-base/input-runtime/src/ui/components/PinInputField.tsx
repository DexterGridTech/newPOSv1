import React from 'react'
import {InputField, type InputFieldProps} from './InputField'

export const PinInputField: React.FC<Omit<InputFieldProps, 'mode'>> = props => (
    <InputField {...props} mode="virtual-pin" secureTextEntry />
)
