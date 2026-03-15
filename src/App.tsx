import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import Builder from "./pages/builder";
import History from "./pages/history";
import Deploy from "./pages/deploy";

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Builder />} />
          <Route path="/history" element={<History />} />
          <Route path="/deploy/:id" element={<Deploy />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
