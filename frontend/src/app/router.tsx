import { createBrowserRouter } from "react-router-dom";
import { Layout } from "../components/layout/Layout";
import { LandingPage } from "../pages/LandingPage";
import { Marketplace } from "../pages/Marketplace";
import { DoctorProfile } from "../pages/DoctorProfile";
import { PaymentPage } from "../pages/PaymentPage";
import { PaymentResult } from "../pages/PaymentResult";
import { LiveTicket } from "../pages/LiveTicket";
import { LiveTicket as LiveTicketByToken } from "../pages/queue/LiveTicket";
import { PatientDashboard } from "../pages/PatientDashboard";
import { DoctorDashboard } from "../pages/DoctorDashboard";
import { LoginPage } from "../pages/auth/LoginPage";
import { SignupPage } from "../pages/auth/SignupPage";
import { ProtectedRoute } from "../components/auth/ProtectedRoute";
import { OrgOnboardingPage } from "../pages/org/OrgOnboardingPage";
import { AcceptInvitePage } from "../pages/org/AcceptInvitePage";
import { AdminDashboard } from "../pages/admin/AdminDashboard";
import { ReceptionistDashboard } from "../pages/receptionist/ReceptionistDashboard";
import { LiveQueuePage } from "../pages/public/LiveQueuePage";
import { ReviewPage } from "../pages/public/ReviewPage";
import { OrgProvider } from "../context/OrgContext";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: "search", element: <Marketplace /> },
      { path: "doctors/:doctorId", element: <DoctorProfile /> },
      { path: "login", element: <LoginPage /> },
      { path: "signup", element: <SignupPage /> },
      { path: "payment-result", element: <PaymentResult /> },
      { path: "org/signup", element: <OrgOnboardingPage /> },
      { path: "accept-invite", element: <AcceptInvitePage /> },
      { path: "q/:token", element: <LiveQueuePage /> },
      { path: "ticket/:token", element: <LiveTicketByToken /> },
      { path: "review", element: <ReviewPage /> },
      {
        path: "checkout",
        element: (
          <ProtectedRoute role="patient">
            <PaymentPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "ticket",
        element: (
          <ProtectedRoute role="patient">
            <LiveTicket />
          </ProtectedRoute>
        ),
      },
      {
        path: "dashboard",
        element: (
          <ProtectedRoute role="patient">
            <PatientDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: "doctor-dashboard",
        element: (
          <ProtectedRoute role="doctor">
            <OrgProvider>
              <DoctorDashboard />
            </OrgProvider>
          </ProtectedRoute>
        ),
      },
      {
        path: "admin",
        element: (
          <ProtectedRoute role="admin">
            <OrgProvider>
              <AdminDashboard />
            </OrgProvider>
          </ProtectedRoute>
        ),
      },
      {
        path: "reception",
        element: (
          <ProtectedRoute role="receptionist">
            <OrgProvider>
              <ReceptionistDashboard />
            </OrgProvider>
          </ProtectedRoute>
        ),
      },
    ],
  },
]);
