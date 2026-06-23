import { createBrowserRouter } from "react-router-dom";
import { LandingPage } from "../pages/public/LandingPage";
import { DoctorProfilePage } from "../pages/public/DoctorProfilePage";
import { PaymentPage } from "../pages/booking/PaymentPage";
<<<<<<< HEAD

=======
import { DoctorDashboardPage } from "../pages/doctor/DoctorDashboardPage";
import { DoctorSessionQueuePage } from "../pages/doctor/DoctorSessionQueuePage";
>>>>>>> 7a83634e1ffa21b7db94c8ad5290d61944d50e3c
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
<<<<<<< HEAD
=======
  {
    path: "/doctor/dashboard",
    element: <DoctorDashboardPage />,
  },
  {
    path: "/doctor/sessions/:sessionId/queue",
    element: <DoctorSessionQueuePage />,
  },
>>>>>>> 7a83634e1ffa21b7db94c8ad5290d61944d50e3c
]);
