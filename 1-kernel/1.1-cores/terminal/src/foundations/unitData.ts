import {Unit, UnitData, UnitDataState, UnitType} from "../types";

export const getPathValuesFromUnitData = (
    model: Unit,
    operatingEntity: Unit,
    unitDataSet: UnitDataState) => {
    const pathValues: { [path: string]: UnitData<any> } = {}

    Object.keys(unitDataSet).forEach(id => {
        if(id==='_persist')
            return
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
    pathValues1: UnitData<any>,
    pathValues2: UnitData<any>) => {
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

    if (value1UnitType === UnitType.MODEL) {
        const value1Index = modelRootPath.indexOf(value1UnitId)
        const value2Index = modelRootPath.indexOf(value2UnitId)
        return value1Index > value2Index
    }
    if (value1UnitType === UnitType.ENTITY) {
        const value1Index = operatingEntityRootPath.indexOf(value1UnitId)
        const value2Index = operatingEntityRootPath.indexOf(value2UnitId)
        return value1Index > value2Index
    }
    return true
}