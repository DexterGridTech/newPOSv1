export interface Money {
    /**
     * Amount in the smallest currency unit. For CNY this is fen, not yuan:
     * 10000 means CNY 100.00, 2000 means CNY 20.00.
     *
     * Keep this unit consistent across thresholds, deductions, allocations, and settlement candidates.
     * Mixing yuan and fen will make “满 200 减 20” become either 2.00 or 2000.00 by accident.
     */
    amount: number
    currency: string
}
