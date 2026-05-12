import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { setAppNavigate } from "@/navigation/appNavigate";

/** Registers React Router `navigate` for `appNavigate()` — mount once inside `Router`. */
export function NavigateBinder() {
  const navigate = useNavigate();
  useEffect(() => {
    setAppNavigate(navigate);
    return () => setAppNavigate(undefined);
  }, [navigate]);
  return null;
}
