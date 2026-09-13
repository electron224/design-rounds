import type { ClassModel } from "./types";
import type { ProjectFile } from "./files";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export interface CoherenceReport {
  /** Class names modeled in Stage 1. */
  entities: string[];
  /** Modeled entities never mentioned in the flow. */
  missingInFlow: string[];
  /** Modeled entities never appearing in the code. */
  missingInCode: string[];
  /** Classes defined in code that were never modeled. */
  unmodeledInCode: string[];
}

/**
 * Cross-stage coherence: the same entities must survive objects → flow →
 * code. Pure set intersection over normalized names — catches the classic
 * interview failure of a diagram and a codebase describing different systems.
 */
export function checkCoherence(
  classes: ClassModel[],
  flowText: string,
  files: ProjectFile[]
): CoherenceReport {
  const entities = classes
    .map((c) => c.name.trim())
    .filter((n) => n.length > 1);
  const flow = norm(flowText);
  const code = norm(files.map((f) => f.content).join("\n"));
  const entityKeys = entities.map(norm);

  const definedInCode = new Set<string>();
  const re = /class\s+([A-Za-z_][A-Za-z0-9_]*)/g;
  const allCode = files.map((f) => f.content).join("\n");
  let m: RegExpExecArray | null;
  while ((m = re.exec(allCode)) !== null) definedInCode.add(norm(m[1]));

  return {
    entities,
    missingInFlow: entities.filter((_, i) => !flow.includes(entityKeys[i])),
    missingInCode: entities.filter((_, i) => !code.includes(entityKeys[i])),
    unmodeledInCode: [...definedInCode].filter(
      (c) => c.length > 1 && !entityKeys.includes(c)
    )
  };
}
