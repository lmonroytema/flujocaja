import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import DashboardPage from "@/pages/DashboardPage";
import ExchangeRatesPage from "@/pages/ExchangeRatesPage";
import ImportPage from "@/pages/ImportPage";
import IncomeCashFlowPage from "@/pages/IncomeCashFlowPage";
import ProjectsPage from "@/pages/ProjectsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/importaciones" element={<ImportPage />} />
          <Route path="/proyectos" element={<ProjectsPage />} />
          <Route path="/flujo-caja/ingresos" element={<IncomeCashFlowPage />} />
          <Route path="/configuracion/tipos-cambio" element={<ExchangeRatesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
