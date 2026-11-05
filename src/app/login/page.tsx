import { demoAccounts } from "@/lib/demo";
import { LoginForm } from "./login-form";

// Read DEMO_MODE per request (it differs between the real and the demo Worker).
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginForm demoLogins={demoAccounts()} />;
}
