import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "../components/layout/AppLayout";
import { HomePage } from "../pages/HomePage";
import { CreateSpotTestPage } from "../pages/tests/CreateSpotTestPage";
import { GettersTestPage } from "../pages/tests/GettersTestPage";

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
        path: "tests/getters",
        element: <GettersTestPage />
      },
      {
        path: "tests/createSpot",
        element: <CreateSpotTestPage />
      }
    ]
  }
]);
