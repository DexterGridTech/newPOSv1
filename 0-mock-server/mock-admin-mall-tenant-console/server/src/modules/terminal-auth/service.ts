export const getTerminalAuthCapabilities = () => ({
  status: 'RESERVED',
  implemented: false,
  routes: [
    '/api/v1/terminal-auth/login',
    '/api/v1/terminal-auth/logout',
    '/api/v1/terminal-auth/user-info-changed',
  ],
  tdpPublishPath: 'terminal auth/session events will be published through mock-terminal-platform TDP projections',
})
