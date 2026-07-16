import { RegisterLoginForm } from '../../components/modals/RegisterLogin'

/** Fallback page for the Register/Login modal (IA §7.1) — deep links and no-JS entry points land
 * here instead of the overlay. Renders the exact same wizard as the modal. */
export default function Login() {
  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-2xl font-bold text-ink">Sign in</h1>
      <RegisterLoginForm />
    </div>
  )
}
