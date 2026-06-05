import fs from "fs";
import path from "path";

const repoRoot = process.cwd();

const resolveSeedPath = (envVarName: string, defaultRelativePath: string, exampleRelativePath: string) => {
  const envPath = process.env[envVarName];
  const resolvedPath = envPath
    ? path.resolve(repoRoot, envPath)
    : path.resolve(repoRoot, defaultRelativePath);

  if (!fs.existsSync(resolvedPath)) {
    const examplePath = path.resolve(repoRoot, exampleRelativePath);
    throw new Error(
      `Missing seed data file: ${resolvedPath}. Create it from ${examplePath} or set ${envVarName}.`,
    );
  }

  return resolvedPath;
};

export const loadJsonSeedFile = <T>(
  envVarName: string,
  defaultRelativePath: string,
  exampleRelativePath: string,
): T => {
  const filePath = resolveSeedPath(envVarName, defaultRelativePath, exampleRelativePath);
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T;
};
