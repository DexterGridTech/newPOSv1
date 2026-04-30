export interface EntryIdentityCredential {
    identityType: string
    identityValue: string
    credentialType?: 'barcode' | 'phone' | 'cardNo' | 'externalToken' | 'manual'
    credentialPayload?: Record<string, unknown>
}

export interface MembershipProfile {
    membershipKey: string
    membershipType: string
    planCode: string
    levelCode?: string
    levelCodes?: string[]
    status: 'active' | 'inactive' | 'expired' | 'frozen'
    qualificationAttributes?: Record<string, unknown>
    validFrom?: string
    validTo?: string
}

export interface CustomerIdentity {
    identityKey: string
    identityType: string
    identityValue: string
    displayName?: string
    status: 'active' | 'inactive' | 'unbound'
    memberships: MembershipProfile[]
    attributes?: Record<string, unknown>
}

export interface CustomerIdentitySnapshot {
    entryIdentity: EntryIdentityCredential
    identities: CustomerIdentity[]
    snapshotVersion?: number
    fetchedAt?: string
}

export interface IdentityDiagnostic {
    identityKey?: string
    level: 'info' | 'warn' | 'error'
    code: string
    message?: string
}
