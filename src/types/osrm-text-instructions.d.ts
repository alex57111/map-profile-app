declare module "osrm-text-instructions" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export interface OsrmTextInstructionsCompiler {
    compile(language: string, step: any, options?: { legIndex?: number; legCount?: number }): string
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export default function OSRMTextInstructions(version: string): OsrmTextInstructionsCompiler
}
