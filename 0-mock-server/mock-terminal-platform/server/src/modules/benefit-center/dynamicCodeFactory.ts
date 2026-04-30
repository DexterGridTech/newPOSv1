export const createDynamicBenefitCodeActivation = (input: {
  contextRef: {
    contextType: 'cart' | 'order' | 'payment'
    contextId: string
    isCurrent?: boolean
  }
  code: string
  codeType?: 'promotionCode' | 'couponCode' | 'voucherCode' | 'unknown'
}) => {
  const code = input.code.trim()
  const isCoupon = input.codeType === 'couponCode' || input.codeType === 'voucherCode'
  const templateKey = `code-template-${code}`
  const lineKey = `code-line-${code}`
  const template = isCoupon
    ? createDynamicCouponTemplate(templateKey)
    : createDynamicPromotionTemplate(templateKey)

  return {
    activationId: `activation-${code}-${input.contextRef.contextId}`,
    contextRef: input.contextRef,
    code,
    activatedTemplates: [template],
    activatedLines: isCoupon ? [createDynamicCouponLine(lineKey, templateKey, code)] : [],
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    diagnostics: [],
  }
}

const createDynamicPromotionTemplate = (templateKey: string) => ({
  templateKey,
  templateCode: templateKey.toUpperCase(),
  version: 1,
  status: 'active',
  calculationSchemaVersion: 1,
  eligibilityPolicy: {},
  effectPolicy: {
    kind: 'amountOff',
    amount: {amount: 1000, currency: 'CNY'},
  },
  basisPolicy: {
    thresholdBase: 'currentRemainingAmount',
    discountBase: 'currentRemainingAmount',
    includePriorAdjustments: true,
    includeGiftLines: false,
    includeExchangeLines: false,
  },
  selectionPolicy: {
    mode: 'auto',
    trigger: 'codeActivated',
  },
  reservationPolicy: {
    mode: 'none',
    subject: 'custom',
    releaseOn: ['codeRemoved'],
  },
  stackingPolicy: {
    priority: 60,
    stackMode: 'stackable',
  },
  allocationPolicy: {
    target: 'matchedLines',
    method: 'byAmountRatio',
    rounding: 'floorToCent',
    remainder: 'largestAmountLine',
    includeZeroAmountLines: false,
    refundReversal: 'byOriginalAllocation',
  },
  settlementPolicy: {
    createSettlementLineCandidate: false,
    settlementLineType: 'pricing_adjustment_record',
    amountRole: 'payableImpact',
    copySettlementPayload: true,
  },
  lifecyclePolicy: {
    refundBehavior: 'returnBenefit',
    partialRefundBehavior: 'byOriginalAllocation',
  },
})

const createDynamicCouponTemplate = (templateKey: string) => ({
  ...createDynamicPromotionTemplate(templateKey),
  selectionPolicy: {
    mode: 'manual',
    trigger: 'codeActivated',
  },
  reservationPolicy: {
    mode: 'onSelection',
    subject: 'benefitLine',
    releaseOn: ['codeRemoved', 'benefitRemoved', 'orderCanceled', 'paymentTimeout'],
  },
  settlementPolicy: {
    createSettlementLineCandidate: true,
    settlementLineType: 'coupon_deduction',
    quantityUnit: 'piece',
    amountRole: 'payableImpact',
    copySettlementPayload: true,
  },
  settlementPayload: {
    externalSystemCode: 'mock-code-benefit-center',
    faceAmount: 1000,
  },
})

const createDynamicCouponLine = (lineKey: string, templateKey: string, code: string) => ({
  lineKey,
  templateKey,
  lineType: 'asset',
  quantity: 1,
  status: 'available',
  settlementPayload: {
    externalLineNo: code,
  },
})

