import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "../components/layout/AppLayout";
import { AddSpotPage } from "../pages/AddSpotPage";
import { BookingPage } from "../pages/BookingPage";
import { HomePage } from "../pages/HomePage";
import { ProfilePage } from "../pages/ProfilePage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <HomePage />
      },
      {
        path: "add-spot",
        element: <AddSpotPage />
      },
      {
        path: "booking/:spotId",
        element: <BookingPage />
      },
      {
        path: "profile",
        element: <ProfilePage />
      }
    ]
  }
]);
