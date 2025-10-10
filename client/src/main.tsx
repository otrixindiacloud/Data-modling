import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./lib/fetchWithAuth";
import { AuthProvider } from "@/context/AuthContext";

createRoot(document.getElementById("root")!).render(
	<AuthProvider>
		<App />
	</AuthProvider>,
);
