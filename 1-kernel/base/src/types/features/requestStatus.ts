export type RequestQueryStatus = 'notFound' | 'loading' | 'complete' | 'error';
export interface RequestQueryResult {
    requestId: string;
    status: RequestQueryStatus;
    errorMessage: string | null;
    startAt: number | null;
    completeAt: number | null;
    errorAt: number | null;
}
