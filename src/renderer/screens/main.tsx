import { AppProvider } from '../contexts'
import { MainApplication } from '../components/MainApplication'

export function MainScreen() {
  return (
    <AppProvider>
      <MainApplication />
    </AppProvider>
  )
}
