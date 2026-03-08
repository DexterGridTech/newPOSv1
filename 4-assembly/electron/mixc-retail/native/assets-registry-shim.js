// Shim for @react-native/assets-registry to avoid Flow syntax issues
export function registerAsset(asset) {
  return asset;
}

export function getAssetByID(assetId) {
  return null;
}
