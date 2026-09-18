import { Outlet } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";

const Layout = () => {
  return (
    <div className="flex flex-col h-screen">
      <Header />

      {/* Body: Sidebar + Main content */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        {/* Main content area */}
        <div className="flex-1 overflow-auto bg-slate-50  p-5 transition-all duration-300">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default Layout;
