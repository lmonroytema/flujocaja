import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthContext";
import { ProtectedRoute } from "@/auth/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import BankBalancesPage from "@/pages/BankBalancesPage";
import DashboardPage from "@/pages/DashboardPage";
import ExchangeRatesPage from "@/pages/ExchangeRatesPage";
import Home from "@/pages/Home";
import ImportPage from "@/pages/ImportPage";
import IncomeCashFlowPage from "@/pages/IncomeCashFlowPage";
import PurchaseOrderFinancePage from "@/pages/PurchaseOrderFinancePage";
import PurchasesApiConfigPage from "@/pages/PurchasesApiConfigPage";
import PurchasesWeeklySpendPage from "@/pages/PurchasesWeeklySpendPage";
import ProjectsPage from "@/pages/ProjectsPage";
import SecurityPage from "@/pages/SecurityPage";
import UserManagementPage from "@/pages/UserManagementPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/importaciones" element={<ImportPage />} />
              <Route path="/proyectos" element={<ProjectsPage />} />
              <Route path="/flujo-caja/ingresos" element={<IncomeCashFlowPage />} />
              <Route path="/configuracion/saldos-bancos" element={<BankBalancesPage />} />
              <Route path="/configuracion/tipos-cambio" element={<ExchangeRatesPage />} />
              <Route path="/integraciones/compras/configuracion" element={<PurchasesApiConfigPage />} />
              <Route path="/integraciones/compras/gastos-semanales" element={<PurchasesWeeklySpendPage />} />
              <Route path="/integraciones/compras/ordenes" element={<PurchaseOrderFinancePage />} />
              <Route path="/mi-seguridad" element={<SecurityPage />} />
              <Route path="/usuarios" element={<UserManagementPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
