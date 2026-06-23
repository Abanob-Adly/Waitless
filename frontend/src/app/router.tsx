import { createBrowserRouter } from "react-router-dom";
import { LandingPage } from "../pages/public/LandingPage";
import { DoctorProfilePage } from "../pages/public/DoctorProfilePage";
import { PaymentPage } from "../pages/booking/PaymentPage";

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
]);
