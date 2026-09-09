// Prism's language components are legacy scripts that assign to a free `Prism`
// variable, so `prism-core` must be evaluated first to install the singleton.
// Importing both through this module keeps that order in one place and avoids
// `eval`, which a Content-Security-Policy would block in production.
import Prism from "prismjs/components/prism-core";
import "prismjs/components/prism-sql";

if (!Prism.languages.sql) throw new Error("Prism SQL grammar failed to initialize");

export default Prism;
