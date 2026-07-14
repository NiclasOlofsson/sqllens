// Wipe build/generated artifacts for a fresh state: the antlr-ng output (src/generated) and the
// published build (dist). Both are gitignored build products; `npm run gen` / `npm run build`
// recreate them. Cross-platform (fs.rmSync, no shell rm).
import { rmSync } from "node:fs";

for (const dir of ["src/generated", "dist"]) {
	rmSync(dir, { recursive: true, force: true });
	console.log(`removed ${dir}`);
}
