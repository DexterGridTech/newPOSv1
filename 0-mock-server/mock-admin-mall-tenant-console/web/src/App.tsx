import {DiagnosticsConsole} from './app/DiagnosticsConsole'
import {CustomerAdminApp} from './customer/CustomerAdminApp'

const resolveEntry = () => {
  const path = window.location.pathname
  const mode = new URLSearchParams(window.location.search).get('mode')

  if (path.startsWith('/diagnostics') || mode === 'diagnostics') {
    return 'diagnostics'
  }

  return 'customer'
}

function App() {
  return resolveEntry() === 'diagnostics' ? <DiagnosticsConsole /> : <CustomerAdminApp />
}

export default App
