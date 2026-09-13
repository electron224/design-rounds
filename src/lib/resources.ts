import type { LLDResource } from "./types";

// NOTE: every URL below was curl-verified (HTTP 200). refactoring.guru links
// were removed after reports they don't load for some learners.
export const RESOURCES: LLDResource[] = [
  { id: "oops-basics", title: "OOP Concepts — Classes, Objects, Encapsulation (GFG)", url: "https://www.geeksforgeeks.org/object-oriented-programming-oops-concept-in-java/", type: "oops", topic: "OOP" },
  { id: "oops-composition", title: "Association, Composition & Aggregation (GFG)", url: "https://www.geeksforgeeks.org/association-composition-aggregation-java/", type: "oops", topic: "OOP" },
  { id: "solid-all", title: "SOLID — The First Five Principles of OOD (DigitalOcean)", url: "https://www.digitalocean.com/community/conceptual-articles/s-o-l-i-d-the-first-five-principles-of-object-oriented-design", type: "solid", topic: "SOLID" },
  { id: "solid-srp", title: "Single Responsibility Principle — S in SOLID (GFG)", url: "https://www.geeksforgeeks.org/system-design/single-responsibility-in-solid-design-principle", type: "solid", topic: "SRP" },
  { id: "solid-ocp", title: "Open/Closed Principle in Java with Examples (GFG)", url: "https://www.geeksforgeeks.org/open-closed-principle-in-java-with-examples/", type: "solid", topic: "OCP" },
  { id: "solid-lsp", title: "Liskov Substitution Principle (Wikipedia)", url: "https://en.wikipedia.org/wiki/Liskov_substitution_principle", type: "solid", topic: "LSP" },
  { id: "solid-isp", title: "Interface Segregation Principle (Wikipedia)", url: "https://en.wikipedia.org/wiki/Interface_segregation_principle", type: "solid", topic: "ISP" },
  { id: "solid-dip", title: "Dependency Inversion Principle — D in SOLID (GFG)", url: "https://www.geeksforgeeks.org/system-design/dependecy-inversion-principle-solid", type: "solid", topic: "DIP" },
  { id: "pat-strategy", title: "Strategy Pattern in Java (DigitalOcean)", url: "https://www.digitalocean.com/community/tutorials/strategy-design-pattern-in-java", type: "pattern", topic: "Strategy" },
  { id: "pat-observer", title: "Observer Pattern in Java (DigitalOcean)", url: "https://www.digitalocean.com/community/tutorials/observer-design-pattern-in-java", type: "pattern", topic: "Observer" },
  { id: "pat-factory", title: "Factory Pattern in Java (DigitalOcean)", url: "https://www.digitalocean.com/community/tutorials/factory-design-pattern-in-java", type: "pattern", topic: "Factory" },
  { id: "pat-singleton", title: "Singleton Best Practices in Java (DigitalOcean)", url: "https://www.digitalocean.com/community/tutorials/java-singleton-design-pattern-best-practices", type: "pattern", topic: "Singleton" },
  { id: "pat-decorator", title: "Decorator Pattern in Java (DigitalOcean)", url: "https://www.digitalocean.com/community/tutorials/decorator-design-pattern-in-java-example", type: "pattern", topic: "Decorator" },
  { id: "pat-state", title: "State Pattern (SourceMaking)", url: "https://sourcemaking.com/design_patterns/state", type: "pattern", topic: "State" },
  { id: "pat-chain", title: "Chain of Responsibility (SourceMaking)", url: "https://sourcemaking.com/design_patterns/chain_of_responsibility", type: "pattern", topic: "Chain of Responsibility" },
  { id: "uml-sequence", title: "Sequence Diagrams Crash Course (Mermaid docs)", url: "https://mermaid.js.org/syntax/sequenceDiagram.html", type: "article", topic: "UML/Flow" },
  { id: "uml-class", title: "Class Diagrams Crash Course (Mermaid docs)", url: "https://mermaid.js.org/syntax/classDiagram.html", type: "article", topic: "UML/Flow" }
];

export const resourceById = (id: string) =>
  RESOURCES.find((r) => r.id === id);
