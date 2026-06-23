import { createBrowserRouter } from "react-router-dom";
import { LandingPage } from "../pages/public/LandingPage";
import { DoctorProfilePage } from "../pages/public/DoctorProfilePage";
import { PaymentPage } from "../pages/booking/PaymentPage";
import { DoctorDashboardPage } from "../pages/doctor/DoctorDashboardPage";
import { DoctorSessionQueuePage } from "../pages/doctor/DoctorSessionQueuePage";
export const router = createBrowserRouter([
  {
    path: "/",
    element: <LandingPage />,
  },
  {
    path: "/doctors/:doctorId",
    element: <DoctorProfilePage />,
  },
  {
    path: "/payment",
    element: <PaymentPage />,
  },
  {
    path: "/doctor/dashboard",
    element: <DoctorDashboardPage />,
  },
  {
    path: "/doctor/sessions/:sessionId/queue",
    element: <DoctorSessionQueuePage />,
  },
]);
