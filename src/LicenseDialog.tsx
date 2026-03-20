import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";

interface LicenseEntry {
  name: string;
  version: string;
  license: string;
  repository?: string;
  author?: string;
}

const PROJECT_LICENSES = [
  {
    name: "sql-validator (core)",
    license: "GPL-3.0",
    description: "The core application is licensed under the GNU General Public License v3.0.",
    url: "https://github.com/Edwinexd/sql-validator?tab=GPL-3.0-1-ov-file",
  },
  {
    name: "ra-engine (Relational Algebra)",
    license: "BSL-1.1",
    description: "The relational algebra engine (src/ra-engine/) is licensed under the Business Source License 1.1, converting to GPL-3.0 on 2035-03-20.",
    url: "https://github.com/Edwinexd/sql-validator/blob/master/src/ra-engine/LICENSE.md",
  },
];

export default function LicenseDialog() {
  const [open, setOpen] = useState(false);
  const [deps, setDeps] = useState<LicenseEntry[]>([]);

  useEffect(() => {
    if (open && deps.length === 0) {
      fetch("/licenses.json")
        .then(r => r.json())
        .then(setDeps)
        .catch(() => setDeps([]));
    }
  }, [open, deps.length]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-blue-600 dark:text-blue-400 hover:underline"
      >
        Licenses
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto p-0">
          <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between z-10">
            <h2 className="text-xl font-semibold">Licenses</h2>
            <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-6 py-4 space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">Project Licenses</h3>
              <div className="space-y-3">
                {PROJECT_LICENSES.map(l => (
                  <div key={l.name} className="border border-gray-200 dark:border-slate-700 rounded-md p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{l.name}</span>
                      <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">{l.license}</a>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{l.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">Third-Party Dependencies</h3>
              {deps.length === 0 ? (
                <p className="text-sm text-gray-500">Loading...</p>
              ) : (
                <div className="border border-gray-200 dark:border-slate-700 rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-slate-800 text-left">
                        <th className="px-3 py-2 font-medium">Package</th>
                        <th className="px-3 py-2 font-medium">Version</th>
                        <th className="px-3 py-2 font-medium">License</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deps.map(dep => (
                        <tr key={dep.name} className="border-t border-gray-100 dark:border-slate-700/50">
                          <td className="px-3 py-1.5">
                            {dep.repository ? (
                              <a href={dep.repository} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">{dep.name}</a>
                            ) : dep.name}
                          </td>
                          <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400">{dep.version}</td>
                          <td className="px-3 py-1.5">{dep.license}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
