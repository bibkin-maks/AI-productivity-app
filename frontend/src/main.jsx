import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { Provider } from "react-redux";
import { store } from "./store/store";

import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext";
import "./index.css";

// Google OAuth Client ID (required)
const googleApi = import.meta.env.VITE_GOOGLE_CLIENT_ID;

if (!googleApi) {
  console.error("❌ Missing Google OAuth Client ID (VITE_GOOGLE_CLIENT_ID).");
}

createRoot(document.getElementById("root")).render(
 <StrictMode>
          {/* Router must be outer wrapper */}
          <BrowserRouter>

            {/* Google OAuth context */}
            <GoogleOAuthProvider clientId={googleApi}>
                    <Provider store={store}>

                          {/* Authentication context (user + token) */}
                          <AuthProvider>

                            {/* App routes + Redux store provider inside App */}
                            <App />

                          </AuthProvider>
                      </Provider>
                    

            </GoogleOAuthProvider>
          </BrowserRouter>
        
   </StrictMode>
);
