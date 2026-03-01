import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const PrivacyNoticeToggle = () => {
  const [open, setOpen] = useState(false);

  if (import.meta.env.VITE_PRIVACY_CF_WEB_ANALYTICS !== "true") {
    return null;
  }

  return (
    <div>
      <button
        onClick={() => setOpen(true)}
        className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer bg-transparent border-0 p-0"
      >
        Privacy Notice
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Privacy Notice</DialogTitle>
          </DialogHeader>
          <p className="text-left text-base font-medium mb-4">
            This app does not collect or store personal data. This deployment uses {" "}
            <a href="https://www.cloudflare.com/web-analytics/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
              Cloudflare&apos;s privacy-first web analytics
            </a>{" "}
            for general usage statistics without tracking individual users.{" "}
            {import.meta.env.VITE_PRIVACY_COMPANY_NAME} ({import.meta.env.VITE_PRIVACY_COMPANY_PARENTHESES_VALUE}) is the
            responsible data provider for this deployment of the app. For inquiries, contact{" "}
            <a href={`mailto:${import.meta.env.VITE_PRIVACY_EMAIL}`} className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
              {import.meta.env.VITE_PRIVACY_EMAIL}
            </a>.
          </p>
          <div className="text-right">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PrivacyNoticeToggle;
