import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ReviewPage from "./pages/ReviewPage";
import PrivacyPage from "./pages/PrivacyPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/r/:slug" element={<ReviewPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="*" element={<Navigate to="/r/demo" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
