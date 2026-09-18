// src/components/ProgressListener.tsx
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import NProgress from "nprogress";
import "nprogress/nprogress.css"; // still need the base CSS

export const ProgressListener = () => {
  const location = useLocation();

  // configure NProgress exactly once
  NProgress.configure({
    showSpinner: false,
    trickleSpeed: 200,

    // override the default HTML — inject your color inline:
    template: `
      <div class="bar" role="bar" style="background: #4f46e5; height: 2px;">
        <div class="peg" style="box-shadow: 0 0 10px #4f46e5, 0 0 5px #4f46e5;"></div>
      </div>
    `,
  });

  useEffect(() => {
    NProgress.start();
    window.scrollTo(0, 0);
  }, [location]);

  useEffect(() => {
    NProgress.done();
  });

  return null;
};

export default ProgressListener;
