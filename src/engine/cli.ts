/**
 * CLI: trace a claim against the live Wikipedia API and print its
 * ClaimProvenance as JSON — the same shape the UI reads from the mocks.
 *
 *   node --experimental-strip-types src/engine/cli.ts <article> <phrase> [--lang en]
 *
 * Example:
 *   node --experimental-strip-types src/engine/cli.ts Quokka "happiest animal"
 */
import { ClaimNotFoundError, traceClaim } from "./trace.ts";

async function main(argv: string[]): Promise<number> {
  const args = argv.slice(2);
  let lang = "en";
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--lang") lang = args[++i] ?? "en";
    else positional.push(args[i]);
  }

  const [article, phrase] = positional;
  if (!article || !phrase) {
    process.stderr.write(
      'Usage: cli.ts <article> <phrase> [--lang en]\n' +
        'Example: cli.ts Quokka "happiest animal"\n',
    );
    return 2;
  }

  try {
    const provenance = await traceClaim({ article, phrase, lang });
    process.stdout.write(JSON.stringify(provenance, null, 2) + "\n");
    return 0;
  } catch (err) {
    if (err instanceof ClaimNotFoundError) {
      process.stderr.write(err.message + "\n");
      return 1;
    }
    throw err;
  }
}

main(process.argv).then((code) => {
  process.exitCode = code;
});
