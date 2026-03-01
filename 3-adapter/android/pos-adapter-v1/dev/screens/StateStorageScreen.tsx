import React, {useState, useCallback, useEffect} from 'react'
import {View, Text, TextInput, Pressable, FlatList, StyleSheet, ScrollView, Alert} from 'react-native'
import {stateStorageAdapter} from "../../src/foundations/stateStorage"


const C = {
    bg: '#F5F5F7',
    bgCard: '#FFFFFF',
    border: '#E5E5EA',
    primary: '#007AFF',
    danger: '#FF3B30',
    success: '#34C759',
    textPrimary: '#000000',
    textSecondary: '#8E8E93',
    textMuted: '#C7C7CC',
    textInverse: '#FFFFFF',
}

interface StoredItem {
    key: string
    value: string
    type: string
}

export const StateStorageScreen = () => {
    const [key, setKey] = useState('')
    const [value, setValue] = useState('')
    const [items, setItems] = useState<StoredItem[]>([])
    const [result, setResult] = useState<string | null>(null)

    // 加载所有存储的键值对
    const loadAll = useCallback(async () => {
        try {
            const allKeys = stateStorageAdapter.getAllKeys()
            const loadedItems: StoredItem[] = await Promise.all(
                allKeys.map(async k => {
                    const val = await stateStorageAdapter.getItem(k)
                    let type = 'string'
                    let displayValue = ''

                    if (val === null || val === undefined) {
                        type = 'null'
                        displayValue = 'null'
                    } else if (typeof val === 'string') {
                        displayValue = val
                        try {
                            const parsed = JSON.parse(val)
                            type = typeof parsed
                            if (Array.isArray(parsed)) type = 'array'
                            if (parsed === null) type = 'null'
                            displayValue = JSON.stringify(parsed, null, 2)
                        } catch {
                            // 保持原始字符串
                        }
                    } else {
                        type = typeof val
                        if (Array.isArray(val)) type = 'array'
                        displayValue = JSON.stringify(val, null, 2)
                    }

                    return {key: k, value: displayValue, type}
                })
            )
            setItems(loadedItems.sort((a, b) => a.key.localeCompare(b.key)))
            setResult(`✅ 加载了 ${loadedItems.length} 个键值对`)
        } catch (e: any) {
            setResult(`❌ 加载失败: ${e?.message ?? e}`)
        }
    }, [])

    useEffect(() => {
        loadAll()
    }, [loadAll])

    // 设置值
    const handleSet = useCallback(async () => {
        if (!key.trim()) {
            Alert.alert('错误', '请输入键名')
            return
        }

        try {
            // 尝试解析为JSON
            let valueToStore: any = value
            try {
                valueToStore = JSON.parse(value)
            } catch {
                // 保持字符串
            }

            await stateStorageAdapter.setItem(key, valueToStore)
            setResult(`✅ 已设置: ${key}`)
            loadAll()
        } catch (e: any) {
            setResult(`❌ 设置失败: ${e?.message ?? e}`)
        }
    }, [key, value, loadAll])

    // 获取值
    const handleGet = useCallback(async () => {
        if (!key.trim()) {
            Alert.alert('错误', '请输入键名')
            return
        }

        try {
            const val = await stateStorageAdapter.getItem(key)
            if (val === null || val === undefined) {
                setResult(`⚠️ 键 "${key}" 不存在`)
                setValue('')
            } else {
                const displayValue = typeof val === 'string' ? val : JSON.stringify(val, null, 2)
                setValue(displayValue)
                setResult(`✅ 已获取: ${key}`)
            }
        } catch (e: any) {
            setResult(`❌ 获取失败: ${e?.message ?? e}`)
        }
    }, [key])

    // 删除值
    const handleRemove = useCallback(async () => {
        if (!key.trim()) {
            Alert.alert('错误', '请输入键名')
            return
        }

        try {
            await stateStorageAdapter.removeItem(key)
            setResult(`✅ 已删除: ${key}`)
            setValue('')
            loadAll()
        } catch (e: any) {
            setResult(`❌ 删除失败: ${e?.message ?? e}`)
        }
    }, [key, loadAll])

    // 清空所有
    const handleClearAll = useCallback(() => {
        Alert.alert(
            '确认清空',
            '确定要删除所有存储的数据吗?此操作不可恢复!',
            [
                {text: '取消', style: 'cancel'},
                {
                    text: '清空',
                    style: 'destructive',
                    onPress: () => {
                        try {
                            stateStorageAdapter.clearAll()
                            setResult('✅ 已清空所有数据')
                            setItems([])
                            setKey('')
                            setValue('')
                        } catch (e: any) {
                            setResult(`❌ 清空失败: ${e?.message ?? e}`)
                        }
                    },
                },
            ]
        )
    }, [])

    // 从列表选择项
    const handleSelectItem = useCallback((item: StoredItem) => {
        setKey(item.key)
        setValue(item.value)
        setResult(null)
    }, [])

    // 快速测试
    const handleQuickTest = useCallback(async () => {
        try {
            // 测试字符串
            await stateStorageAdapter.setItem('test_string', 'Hello MMKV')
            const str = await stateStorageAdapter.getItem('test_string')

            // 测试对象
            await stateStorageAdapter.setItem('test_object', {name: 'Test', count: 42})
            const obj = await stateStorageAdapter.getItem('test_object')

            // 测试数组
            await stateStorageAdapter.setItem('test_array', [1, 2, 3, 4, 5])
            const arr = await stateStorageAdapter.getItem('test_array')

            // 测试布尔值
            await stateStorageAdapter.setItem('test_boolean', true)
            const bool = await stateStorageAdapter.getItem('test_boolean')

            // 测试数字
            await stateStorageAdapter.setItem('test_number', 3.14159)
            const num = await stateStorageAdapter.getItem('test_number')

            // 验证
            const success =
                str === 'Hello MMKV' &&
                obj.name === 'Test' &&
                obj.count === 42 &&
                Array.isArray(arr) &&
                arr.length === 5 &&
                bool === true &&
                num === 3.14159

            if (success) {
                setResult('✅ 快速测试通过! 所有类型存储正常')
            } else {
                setResult('❌ 快速测试失败! 数据不匹配')
            }

            loadAll()
        } catch (e: any) {
            setResult(`❌ 快速测试失败: ${e?.message ?? e}`)
        }
    }, [loadAll])

    return (
        <View style={s.container}>
            <ScrollView style={s.scroll} contentContainerStyle={{paddingBottom: 32}}>
                {/* 操作区 */}
                <View style={s.section}>
                    <Text style={s.sectionTitle}>键值操作</Text>

                    <View style={s.field}>
                        <Text style={s.label}>键名 (Key)</Text>
                        <TextInput
                            style={s.input}
                            value={key}
                            onChangeText={setKey}
                            placeholder="例如: user_settings"
                            placeholderTextColor={C.textMuted}
                        />
                    </View>

                    <View style={s.field}>
                        <Text style={s.label}>值 (Value) - 支持JSON</Text>
                        <TextInput
                            style={[s.input, s.multiline]}
                            value={value}
                            onChangeText={setValue}
                            placeholder='例如: {"name":"张三","age":25}'
                            placeholderTextColor={C.textMuted}
                            multiline
                            numberOfLines={4}
                        />
                    </View>

                    <View style={s.btnRow}>
                        <Pressable style={({pressed}) => [s.btn, s.btnPrimary, pressed && s.btnPressed]} onPress={handleSet}>
                            <Text style={s.btnText}>设置</Text>
                        </Pressable>
                        <Pressable style={({pressed}) => [s.btn, s.btnSecondary, pressed && s.btnPressed]} onPress={handleGet}>
                            <Text style={[s.btnText, {color: C.primary}]}>获取</Text>
                        </Pressable>
                        <Pressable style={({pressed}) => [s.btn, s.btnDanger, pressed && s.btnPressed]} onPress={handleRemove}>
                            <Text style={s.btnText}>删除</Text>
                        </Pressable>
                    </View>

                    {result && (
                        <View style={s.result}>
                            <Text style={s.resultText}>{result}</Text>
                        </View>
                    )}
                </View>

                {/* 快速测试 */}
                <View style={s.section}>
                    <Text style={s.sectionTitle}>快速测试</Text>
                    <Pressable style={({pressed}) => [s.btn, s.btnSuccess, pressed && s.btnPressed]} onPress={handleQuickTest}>
                        <Text style={s.btnText}>运行快速测试</Text>
                    </Pressable>
                    <Text style={s.hint}>测试字符串、对象、数组、布尔值、数字的存储</Text>
                </View>

                {/* 存储列表 */}
                <View style={s.section}>
                    <View style={s.sectionHeader}>
                        <Text style={s.sectionTitle}>存储列表 ({items.length})</Text>
                        <View style={{flexDirection: 'row', gap: 8}}>
                            <Pressable style={({pressed}) => [s.iconBtn, pressed && s.btnPressed]} onPress={loadAll}>
                                <Text style={s.iconBtnText}>🔄</Text>
                            </Pressable>
                            <Pressable style={({pressed}) => [s.iconBtn, s.iconBtnDanger, pressed && s.btnPressed]} onPress={handleClearAll}>
                                <Text style={s.iconBtnText}>🗑️</Text>
                            </Pressable>
                        </View>
                    </View>

                    {items.length === 0 ? (
                        <Text style={s.emptyText}>暂无存储数据</Text>
                    ) : (
                        <FlatList
                            data={items}
                            keyExtractor={item => item.key}
                            scrollEnabled={false}
                            renderItem={({item}) => (
                                <Pressable
                                    style={({pressed}) => [s.item, pressed && {backgroundColor: C.border}]}
                                    onPress={() => handleSelectItem(item)}>
                                    <View style={s.itemHeader}>
                                        <Text style={s.itemKey}>{item.key}</Text>
                                        <Text style={s.itemType}>{item.type}</Text>
                                    </View>
                                    <Text style={s.itemValue} numberOfLines={3}>
                                        {item.value}
                                    </Text>
                                </Pressable>
                            )}
                        />
                    )}
                </View>
            </ScrollView>
        </View>
    )
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: C.bg,
    },
    scroll: {
        flex: 1,
    },
    section: {
        backgroundColor: C.bgCard,
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: C.border,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: C.textPrimary,
        marginBottom: 12,
    },
    field: {
        marginBottom: 12,
    },
    label: {
        fontSize: 13,
        fontWeight: '500',
        color: C.textSecondary,
        marginBottom: 6,
    },
    input: {
        backgroundColor: C.bg,
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 8,
        padding: 12,
        fontSize: 15,
        color: C.textPrimary,
    },
    multiline: {
        minHeight: 100,
        textAlignVertical: 'top',
    },
    btnRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 4,
    },
    btn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    btnPrimary: {
        backgroundColor: C.primary,
    },
    btnSecondary: {
        backgroundColor: C.bgCard,
        borderWidth: 1,
        borderColor: C.primary,
    },
    btnDanger: {
        backgroundColor: C.danger,
    },
    btnSuccess: {
        backgroundColor: C.success,
    },
    btnPressed: {
        opacity: 0.7,
    },
    btnText: {
        fontSize: 15,
        fontWeight: '600',
        color: C.textInverse,
    },
    result: {
        marginTop: 12,
        padding: 12,
        backgroundColor: C.bg,
        borderRadius: 8,
    },
    resultText: {
        fontSize: 14,
        color: C.textPrimary,
    },
    hint: {
        fontSize: 12,
        color: C.textMuted,
        marginTop: 8,
    },
    iconBtn: {
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: C.bg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconBtnDanger: {
        backgroundColor: C.danger + '20',
    },
    iconBtnText: {
        fontSize: 18,
    },
    item: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    itemKey: {
        fontSize: 15,
        fontWeight: '600',
        color: C.textPrimary,
        flex: 1,
    },
    itemType: {
        fontSize: 12,
        fontWeight: '500',
        color: C.textInverse,
        backgroundColor: C.primary,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    itemValue: {
        fontSize: 13,
        color: C.textSecondary,
        fontFamily: 'monospace',
    },
    emptyText: {
        fontSize: 14,
        color: C.textMuted,
        textAlign: 'center',
        paddingVertical: 24,
    },
})
