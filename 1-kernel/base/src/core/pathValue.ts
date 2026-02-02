import {logger} from "./nativeAdapter";
import {Unit, UnitData, UnitDataState, UnitType} from "../types";

interface DataProvider {
    provider: {
        [category: string]: (path: string) => { id: string, key: string, value: any, updatedAt: number } | null
    }
}

export const customizedPathValue: DataProvider = {
    provider: {},
}

export class SimplePathValue<T> {
    readonly category: string;
    readonly path: string
    readonly name: string
    readonly defaultValue: T

    constructor(category: string, name: string, path: string, defaultValue: T) {
        this.category = category;
        this.name = name;
        this.path = path;
        this.defaultValue = defaultValue;
    }

    value(): T {
        const provider = customizedPathValue.provider[this.category]
        if (provider != null) {
            const customizedDataValue = provider(this.path)
            if (customizedDataValue != null) {

                logger.debug(`${this.category}:${this.name} customize(${customizedDataValue.id})=${customizedDataValue.value}`)
                return customizedDataValue.value as T
            }
        }
        logger.debug(`${this.category}:${this.name} default=${this.defaultValue}`)
        return this.defaultValue;
    }
}

export const getPathValuesFromUnitData = (
    model: Unit,
    operatingEntity: Unit,
    unitDataSet: UnitDataState) => {
    const pathValues: { [path: string]: UnitData } = {}

    Object.keys(unitDataSet).forEach(id => {
        const unitData = unitDataSet[id]
        const prePathValue = pathValues[unitData.path]
        if (prePathValue == null) {
            pathValues[unitData.path] = unitData
        } else {
            if (priorThen(
                model,
                operatingEntity,
                unitData,
                prePathValue,
            )) {
                pathValues[unitData.path] = unitData
            }
        }
    })
    return pathValues
}
export const priorThen = (
    model: Unit,
    operatingEntity: Unit,
    pathValues1: UnitData,
    pathValues2: UnitData) => {
    const value1UnitId = pathValues1.unitId
    const value2UnitId = pathValues2.unitId
    const value1UnitType = pathValues1.unitType
    const value2UnitType = pathValues2.unitType
    const modelRootPath = model.rootPath
    const operatingEntityRootPath = operatingEntity.rootPath
    if (value1UnitType === UnitType.TERMINAL)
        return true
    else if (value2UnitType === UnitType.TERMINAL)
        return false

    if (value1UnitType === UnitType.MODEL && value2UnitType === UnitType.ENTITY)
        return true
    else if (value1UnitType === UnitType.ENTITY && value2UnitType === UnitType.MODEL)
        return false

    if (value1UnitType === UnitType.MODEL){
        const value1Index = modelRootPath.indexOf(value1UnitId)
        const value2Index = modelRootPath.indexOf(value2UnitId)
        return value1Index > value2Index
    }
    if (value1UnitType === UnitType.ENTITY){
        const value1Index = operatingEntityRootPath.indexOf(value1UnitId)
        const value2Index = operatingEntityRootPath.indexOf(value2UnitId)
        return value1Index > value2Index
    }
    return true
}