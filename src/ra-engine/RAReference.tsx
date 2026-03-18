/*
Relational Algebra engine for sql-validator
Copyright (C) 2026 E.SU. IT AB (Org.no 559484-0505) and Edwin Sundberg <edwin@edthing.com>

Licensed under the Business Source License 1.1 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License in the LICENSE.md file in this repository.
*/

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { useLanguage } from "../i18n/context";

const RAReference = () => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
      >
        {t("raReference")}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-bold">{t("raReference")}</h2>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-5 text-sm">
            {/* Unary Operators */}
            <section>
              <h3 className="font-semibold text-base mb-2">{t("raUnaryOps")}</h3>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b dark:border-slate-600">
                    <th className="text-left py-1 pr-3 font-medium">{t("raColOp")}</th>
                    <th className="text-left py-1 pr-3 font-medium">{t("raColSyntax")}</th>
                    <th className="text-left py-1 font-medium">{t("raColDesc")}</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  <tr className="border-b dark:border-slate-700">
                    <td className="py-1.5 pr-3">σ / sigma</td>
                    <td className="py-1.5 pr-3 text-purple-600 dark:text-purple-400">σ[age &gt; 20](R)</td>
                    <td className="py-1.5 font-sans">{t("raDescSelection")}</td>
                  </tr>
                  <tr className="border-b dark:border-slate-700">
                    <td className="py-1.5 pr-3">π / pi</td>
                    <td className="py-1.5 pr-3 text-purple-600 dark:text-purple-400">π[name, city](R)</td>
                    <td className="py-1.5 font-sans">{t("raDescProjection")}</td>
                  </tr>
                  <tr className="border-b dark:border-slate-700">
                    <td className="py-1.5 pr-3">ρ / rho</td>
                    <td className="py-1.5 pr-3 text-purple-600 dark:text-purple-400">ρ[old→new](R)</td>
                    <td className="py-1.5 font-sans">{t("raDescRename")}</td>
                  </tr>
                  <tr className="border-b dark:border-slate-700">
                    <td className="py-1.5 pr-3">γ / gamma</td>
                    <td className="py-1.5 pr-3 text-purple-600 dark:text-purple-400">γ[city; COUNT(id)](R)</td>
                    <td className="py-1.5 font-sans">{t("raDescGroup")}</td>
                  </tr>
                  <tr className="border-b dark:border-slate-700">
                    <td className="py-1.5 pr-3">τ / tau</td>
                    <td className="py-1.5 pr-3 text-purple-600 dark:text-purple-400">τ[name](R)</td>
                    <td className="py-1.5 font-sans">{t("raDescSort")}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 pr-3">δ / delta</td>
                    <td className="py-1.5 pr-3 text-purple-600 dark:text-purple-400">δ(R)</td>
                    <td className="py-1.5 font-sans">{t("raDescDistinct")}</td>
                  </tr>
                </tbody>
              </table>
            </section>

            {/* Binary Operators */}
            <section>
              <h3 className="font-semibold text-base mb-2">{t("raBinaryOps")}</h3>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b dark:border-slate-600">
                    <th className="text-left py-1 pr-3 font-medium">{t("raColOp")}</th>
                    <th className="text-left py-1 pr-3 font-medium">{t("raColSyntax")}</th>
                    <th className="text-left py-1 font-medium">{t("raColDesc")}</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  <tr className="border-b dark:border-slate-700">
                    <td className="py-1.5 pr-3">× / cross</td>
                    <td className="py-1.5 pr-3 text-purple-600 dark:text-purple-400">R × S</td>
                    <td className="py-1.5 font-sans">{t("raDescCross")}</td>
                  </tr>
                  <tr className="border-b dark:border-slate-700">
                    <td className="py-1.5 pr-3">⋈ / natjoin</td>
                    <td className="py-1.5 pr-3 text-purple-600 dark:text-purple-400">R ⋈ S</td>
                    <td className="py-1.5 font-sans">{t("raDescNatJoin")}</td>
                  </tr>
                  <tr className="border-b dark:border-slate-700">
                    <td className="py-1.5 pr-3">⋈ / join</td>
                    <td className="py-1.5 pr-3 text-purple-600 dark:text-purple-400">R ⋈[R.id = S.id] S</td>
                    <td className="py-1.5 font-sans">{t("raDescThetaJoin")}</td>
                  </tr>
                  <tr className="border-b dark:border-slate-700">
                    <td className="py-1.5 pr-3">∪ / union</td>
                    <td className="py-1.5 pr-3 text-purple-600 dark:text-purple-400">R ∪ S</td>
                    <td className="py-1.5 font-sans">{t("raDescUnion")}</td>
                  </tr>
                  <tr className="border-b dark:border-slate-700">
                    <td className="py-1.5 pr-3">∩ / intersect</td>
                    <td className="py-1.5 pr-3 text-purple-600 dark:text-purple-400">R ∩ S</td>
                    <td className="py-1.5 font-sans">{t("raDescIntersect")}</td>
                  </tr>
                  <tr className="border-b dark:border-slate-700">
                    <td className="py-1.5 pr-3">− / minus</td>
                    <td className="py-1.5 pr-3 text-purple-600 dark:text-purple-400">R − S</td>
                    <td className="py-1.5 font-sans">{t("raDescMinus")}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 pr-3">÷ / divide</td>
                    <td className="py-1.5 pr-3 text-purple-600 dark:text-purple-400">R ÷ S</td>
                    <td className="py-1.5 font-sans">{t("raDescDivide")}</td>
                  </tr>
                </tbody>
              </table>
            </section>

            {/* Notation */}
            <section>
              <h3 className="font-semibold text-base mb-2">{t("raNotation")}</h3>
              <div className="space-y-1.5 font-mono text-xs bg-slate-50 dark:bg-slate-800 rounded-md p-3">
                <p><span className="text-purple-600 dark:text-purple-400">σ</span>[cond](R) <span className="font-sans text-gray-500">{t("raNoteBrackets")}</span></p>
                <p><span className="text-purple-600 dark:text-purple-400">σ</span>{"{cond}"}(R) <span className="font-sans text-gray-500">{t("raNoteCurly")}</span></p>
                <p><span className="text-purple-600 dark:text-purple-400">σ</span>{"_{cond}"}(R) <span className="font-sans text-gray-500">{t("raNoteLaTeX")}</span></p>
                <p><span className="text-purple-600 dark:text-purple-400">σ</span> cond (R) <span className="font-sans text-gray-500">{t("raNoteImplicit")}</span></p>
                <p><span className="text-purple-600 dark:text-purple-400">π</span>[cols] <span className="text-purple-600 dark:text-purple-400">σ</span>[cond] R <span className="font-sans text-gray-500">{t("raNoteChain")}</span></p>
              </div>
            </section>

            {/* Assignment */}
            <section>
              <h3 className="font-semibold text-base mb-2">{t("raAssignment")}</h3>
              <div className="font-mono text-xs bg-slate-50 dark:bg-slate-800 rounded-md p-3 space-y-1.5">
                <p>A <span className="text-purple-600 dark:text-purple-400">&lt;-</span> <span className="text-purple-600 dark:text-purple-400">σ</span>[age &gt; 20](Person)</p>
                <p>B <span className="text-purple-600 dark:text-purple-400">&lt;-</span> <span className="text-purple-600 dark:text-purple-400">π</span>[name](A)</p>
                <p className="font-sans text-gray-500 text-xs">{t("raNoteAssignment")}</p>
              </div>
            </section>

            {/* Conditions */}
            <section>
              <h3 className="font-semibold text-base mb-2">{t("raConditions")}</h3>
              <div className="font-mono text-xs bg-slate-50 dark:bg-slate-800 rounded-md p-3 space-y-1.5">
                <p>age &gt; 20 <span className="text-blue-600">AND</span> city = <span className="text-green-600">&apos;York&apos;</span></p>
                <p>age &gt; 20 <span className="text-blue-600">OR</span> age &lt; 10</p>
                <p><span className="text-blue-600">NOT</span> active = 1</p>
                <p className="font-sans text-gray-500 text-xs">{t("raNoteComparison")}</p>
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RAReference;
