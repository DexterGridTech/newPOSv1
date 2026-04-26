import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import express, {Router} from 'express'
import {created, HttpError, wrapRoute} from '../../shared/http.js'
import {createId, normalizeId} from '../../shared/utils.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const assetRoot = path.resolve(currentDir, '../../../data/uploads/customer-assets')
fs.mkdirSync(assetRoot, {recursive: true})
const assetKinds = new Set(['brand-logo', 'product-image', 'menu-product-image'])
const mimeExtensions: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
}

const stringBody = (value: unknown) => typeof value === 'string' ? value.trim() : ''

const safeAssetKind = (value: unknown) => {
  const kind = stringBody(value)
  if (!assetKinds.has(kind)) {
    throw new HttpError(400, 'INVALID_ASSET_KIND', '不支持的图片类型')
  }
  return kind
}

const extensionFrom = (fileName: string, mimeType: string) => {
  const fromMime = mimeExtensions[mimeType.toLowerCase()]
  if (fromMime) return fromMime
  const fromName = path.extname(fileName).toLowerCase()
  return fromName && /^[.][a-z0-9]+$/.test(fromName) ? fromName : '.bin'
}

export const createAssetRouter = () => {
  const router = Router()
  router.use('/uploads/customer-assets', express.static(assetRoot, {fallthrough: false}))

  router.post('/api/v1/customer/assets', wrapRoute((req, res) => {
    const kind = safeAssetKind(req.body.kind)
    const fileName = stringBody(req.body.fileName) || 'asset'
    const mimeType = stringBody(req.body.mimeType) || 'application/octet-stream'
    const contentBase64 = stringBody(req.body.contentBase64)
    if (!contentBase64) {
      throw new HttpError(400, 'ASSET_CONTENT_REQUIRED', '请选择要上传的图片')
    }
    if (!mimeType.startsWith('image/')) {
      throw new HttpError(400, 'ASSET_IMAGE_ONLY', '只能上传图片文件')
    }
    const bytes = Buffer.from(contentBase64, 'base64')
    if (bytes.byteLength === 0) {
      throw new HttpError(400, 'ASSET_EMPTY', '图片内容为空')
    }
    if (bytes.byteLength > 5 * 1024 * 1024) {
      throw new HttpError(400, 'ASSET_TOO_LARGE', '图片不能超过 5MB')
    }

    const sandboxId = normalizeId(res.locals.requestContext?.sandboxId ?? 'default-sandbox') || 'default-sandbox'
    const directory = path.join(assetRoot, sandboxId, kind)
    fs.mkdirSync(directory, {recursive: true})
    const assetId = createId('asset')
    const safeFileName = `${assetId}${extensionFrom(fileName, mimeType)}`
    const filePath = path.join(directory, safeFileName)
    fs.writeFileSync(filePath, bytes)
    created(res, {
      assetId,
      fileName: safeFileName,
      originalFileName: fileName,
      mimeType,
      size: bytes.byteLength,
      url: `/uploads/customer-assets/${sandboxId}/${kind}/${safeFileName}`,
    })
  }))
  return router
}
