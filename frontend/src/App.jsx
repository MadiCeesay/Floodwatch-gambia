import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, RequireAdmin } from "./context/AuthContext";
import { CitizenShell, AdminShell, RouteFocus } from "./components/Layout";
import { Loading, Empty } from "./components/Feedback";
import Home from "./pages/Home";
const ReportFlow = lazy(() => import("./pages/ReportFlow"));
const Explore = lazy(() => import("./pages/Explore"));
const ReportDetail = lazy(() => import("./pages/ReportDetail"));
const MyReports = lazy(() => import("./pages/MyReports"));
const Safety = lazy(() => import("./pages/Safety"));
const Emergency = lazy(() => import("./pages/Emergency"));
const Login = lazy(() => import("./pages/Login"));
const Admin = lazy(() => import("./pages/Admin"));
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RouteFocus />
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route element={<CitizenShell />}>
              <Route index element={<Home />} />
              <Route path="report" element={<ReportFlow />} />
              <Route path="map" element={<Explore />} />
              <Route path="reports/:id" element={<ReportDetail />} />
              <Route path="my-reports" element={<MyReports />} />
              <Route path="safety" element={<Safety />} />
              <Route path="help" element={<Emergency />} />
              <Route path="login" element={<Login />} />
              <Route
                path="*"
                element={
                  <Empty
                    title="Page not found"
                    text="Use the navigation to return to FloodWatch."
                  />
                }
              />
            </Route>
            <Route element={<RequireAdmin />}>
              <Route path="admin" element={<AdminShell />}>
                <Route index element={<Admin section="overview" />} />
                <Route path="reports" element={<Admin section="reports" />} />
                <Route path="map" element={<Admin section="map" />} />
                <Route path="reports/:id" element={<ReportDetail admin />} />
                <Route
                  path="emergencies"
                  element={<Admin section="emergencies" />}
                />
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
