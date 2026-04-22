/**
 * Unit业务逻辑层
 */
import { UnitRepository } from '../repositories/UnitRepository';
import { UnitType } from '../types';
import { validateRequired, validateEnum, validateKey } from '../utils/validator';
import { generateActiveCode, generateDeactiveCode } from '../utils/idGenerator';
export class UnitService {
    unitRepository;
    constructor() {
        this.unitRepository = new UnitRepository();
    }
    /**
     * 创建单元
     */
    create(data) {
        // 参数校验
        const error = validateRequired(data, ['name', 'key', 'type']);
        if (error) {
            throw new Error(error);
        }
        const typeError = validateEnum(data.type, UnitType, 'type');
        if (typeError) {
            throw new Error(typeError);
        }
        const keyError = validateKey(data.key, 'key');
        if (keyError) {
            throw new Error(keyError);
        }
        // 检查key是否已存在
        if (this.unitRepository.existsByKey(data.key)) {
            throw new Error(`Key '${data.key}' already exists`);
        }
        // 如果是terminal类型,需要额外参数
        if (data.type === UnitType.TERMINAL) {
            const terminalError = validateRequired(data, ['entityUnitId', 'modelUnitId']);
            if (terminalError) {
                throw new Error(terminalError);
            }
            // 自动生成激活码和解绑码
            if (!data.activeCode) {
                data.activeCode = generateActiveCode();
            }
            if (!data.deactiveCode) {
                data.deactiveCode = generateDeactiveCode();
            }
        }
        // 如果有parentId,验证parent存在
        if (data.parentId) {
            const parent = this.unitRepository.findById(data.parentId);
            if (!parent) {
                throw new Error(`Parent unit '${data.parentId}' not found`);
            }
            // Terminal类型不能有parent
            if (data.type === UnitType.TERMINAL) {
                throw new Error('Terminal cannot have parent');
            }
            // parent和child必须是同类型
            if (parent.type !== data.type) {
                throw new Error(`Parent type must be '${data.type}'`);
            }
        }
        return this.unitRepository.create(data);
    }
    /**
     * 根据ID查找单元
     */
    findById(id) {
        return this.unitRepository.findById(id);
    }
    /**
     * 根据key查找单元
     */
    findByKey(key) {
        return this.unitRepository.findByKey(key);
    }
    /**
     * 查找所有单元
     */
    findAll(type) {
        return this.unitRepository.findAll(type);
    }
    /**
     * 查找根单元
     */
    findRoots(type) {
        return this.unitRepository.findRoots(type);
    }
    /**
     * 查找树形结构
     */
    findTree(rootId) {
        return this.unitRepository.findTree(rootId);
    }
    /**
     * 更新单元
     */
    update(id, data) {
        // 验证单元存在
        const unit = this.unitRepository.findById(id);
        if (!unit) {
            throw new Error(`Unit '${id}' not found`);
        }
        // 如果更新key,检查是否重复
        if (data.key) {
            const keyError = validateKey(data.key, 'key');
            if (keyError) {
                throw new Error(keyError);
            }
            if (this.unitRepository.existsByKey(data.key, id)) {
                throw new Error(`Key '${data.key}' already exists`);
            }
        }
        return this.unitRepository.update(id, data);
    }
    /**
     * 删除单元
     */
    delete(id) {
        // 验证单元存在
        const unit = this.unitRepository.findById(id);
        if (!unit) {
            throw new Error(`Unit '${id}' not found`);
        }
        // 检查是否有子单元
        const children = this.unitRepository.findChildren(id);
        if (children.length > 0) {
            throw new Error(`Cannot delete unit with ${children.length} children`);
        }
        this.unitRepository.delete(id);
    }
    /**
     * 根据激活码查找终端
     */
    findTerminalByActiveCode(activeCode) {
        return this.unitRepository.findByActiveCode(activeCode);
    }
}
//# sourceMappingURL=UnitService.js.map