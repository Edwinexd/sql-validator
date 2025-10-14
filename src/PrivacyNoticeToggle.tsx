import { XMarkIcon } from "@heroicons/react/24/solid";
import { useRef } from "react";

const PrivacyNoticeToggle = () => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  if (import.meta.env.VITE_PRIVACY_CF_WEB_ANALYTICS !== "true") {
    return null;
  }

  const openDialog = () => dialogRef.current?.showModal();
  const closeDialog = () => dialogRef.current?.close();

  return (
    <div>
      <button 
        onClick={openDialog} 
        className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer bg-transparent border-0 p-0"
      >
        Privacy Notice
      </button>
      <dialog ref={dialogRef} className="rounded-lg max-w-4xl w-full p-6 shadow-lg border dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold">Privacy Notice</h2>
          <XMarkIcon className="w-6 h-6 cursor-pointer text-red-500 hover:text-red-700" onClick={closeDialog} />
        </div>
        <p className="text-left text-lg font-medium mb-4">
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
          <button 
            onClick={closeDialog} 
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer bg-transparent border-0 p-0 font-semibold"
          >
            Close
          </button>
        </div>
      </dialog>
    </div>
  );
};

export default PrivacyNoticeToggle;
