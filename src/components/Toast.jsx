import { Toaster as SonnerToaster, toast } from "sonner";

export { toast };

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      gap={8}
      toastOptions={{
        style: {
          background: "#212121",
          border: "1px solid rgba(67, 67, 67, 0.4)",
          color: "#FAFAFA",
          borderRadius: "12px",
          fontSize: "13px",
          fontFamily: "Inter, sans-serif",
          padding: "12px 14px",
          boxShadow: "0px 10px 10px -5px rgba(0,0,0,0.08), 0px 20px 25px -5px rgba(0,0,0,0.18)",
        },
        className: "compendie-toast",
      }}
    />
  );
}
