import { LanguageDefinition } from "./types";
import sv from "./sv";

const svPg: LanguageDefinition = {
  ...sv,
  code: "sv-pg",
  displayName: "Svenska (PostgreSQL)",
  engine: "postgresql",
};

export default svPg;
