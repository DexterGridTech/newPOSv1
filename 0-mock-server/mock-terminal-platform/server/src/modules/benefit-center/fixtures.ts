export const benefitCenterFixtures = {
  identitySnapshot: {
    entryIdentity: {
      identityType: 'mallMemberCard',
      identityValue: 'MALL-BLACK-001',
      credentialType: 'manual',
    },
    identities: [
      {
        identityKey: 'identity-mall-member-001',
        identityType: 'mallMemberCard',
        identityValue: 'MALL-BLACK-001',
        displayName: 'MIXC Black Card Member',
        status: 'active',
        memberships: [
          {
            membershipKey: 'membership-black-001',
            membershipType: 'mall.black-card',
            planCode: 'MIXC_BEAUTY',
            levelCode: 'BLACK',
            levelCodes: ['BLACK'],
            status: 'active',
            qualificationAttributes: {
              points: 68000,
            },
          },
        ],
      },
    ],
    snapshotVersion: 1,
    fetchedAt: '2026-04-30T00:00:00.000Z',
  },
  benefitSnapshot: {
    templates: [
      {
        templateKey: 'tmpl-black-card-daily-8-off',
        templateCode: 'BLACK_CARD_DAILY_8_OFF',
        version: 1,
        status: 'active',
        calculationSchemaVersion: 1,
        eligibilityPolicy: {
          membershipRequirements: [
            {
              membershipType: 'mall.black-card',
              levelCodes: ['BLACK'],
            },
          ],
        },
        effectPolicy: {
          kind: 'ratioOff',
          discountRatio: 0.2,
        },
        basisPolicy: {
          thresholdBase: 'originalAmount',
          discountBase: 'currentRemainingAmount',
          includePriorAdjustments: true,
          includeGiftLines: false,
          includeExchangeLines: false,
        },
        selectionPolicy: {
          mode: 'auto',
          trigger: 'identityLinked',
        },
        reservationPolicy: {
          mode: 'autoOnOpportunity',
          subject: 'membership',
          subjectMembershipType: 'mall.black-card',
          quotaBucket: {
            bucketKey: 'black-card-daily-8-off',
            window: 'perDay',
            limitQuantity: 1,
            factSources: ['reservationLedger', 'orderFact'],
          },
          ttlSeconds: 7200,
          releaseOn: ['cartCanceled', 'orderCanceled', 'paymentTimeout', 'identityChanged'],
          promoteOn: 'orderCreated',
        },
        stackingPolicy: {
          priority: 100,
          stackMode: 'exclusive',
          groupKey: 'order-pricing',
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
      },
      {
        templateKey: 'tmpl-coupon-100-off',
        templateCode: 'COUPON_100_OFF',
        version: 1,
        status: 'active',
        calculationSchemaVersion: 1,
        eligibilityPolicy: {
          thresholdRequirements: [
            {
              thresholdType: 'amount',
              operator: 'gte',
              amount: {amount: 10000, currency: 'CNY'},
            },
          ],
        },
        effectPolicy: {
          kind: 'amountOff',
          amount: {amount: 10000, currency: 'CNY'},
        },
        basisPolicy: {
          thresholdBase: 'currentRemainingAmount',
          discountBase: 'currentRemainingAmount',
          includePriorAdjustments: true,
          includeGiftLines: false,
          includeExchangeLines: false,
        },
        selectionPolicy: {
          mode: 'manual',
        },
        reservationPolicy: {
          mode: 'onSelection',
          subject: 'benefitLine',
          releaseOn: ['cartCanceled', 'orderCanceled', 'paymentTimeout', 'benefitRemoved'],
        },
        stackingPolicy: {
          priority: 80,
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
          createSettlementLineCandidate: true,
          settlementLineType: 'coupon_deduction',
          quantityUnit: 'piece',
          amountRole: 'payableImpact',
          copySettlementPayload: true,
        },
        lifecyclePolicy: {
          refundBehavior: 'returnBenefit',
          partialRefundBehavior: 'byOriginalAllocation',
        },
        settlementPayload: {
          externalSystemCode: 'coupon-center',
          faceAmount: 10000,
        },
      },
    ],
    lines: [
      {
        lineKey: 'coupon-line-100-off',
        templateKey: 'tmpl-coupon-100-off',
        lineType: 'asset',
        ownerIdentityKey: 'identity-mall-member-001',
        quantity: 1,
        status: 'available',
        settlementPayload: {
          externalLineNo: 'COUPON-100-OFF',
        },
      },
    ],
    reservations: [],
    quotaFacts: [],
  },
} as const
