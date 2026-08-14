# Security

Report vulnerabilities privately through GitHub Security Advisories for this repository.

`dsh-cost` does not contact providers, discover prices, intercept future calls, or read credentials. The DSH tools fold the current session's durable usage metadata; the MCP tools accept only bounded sanitized usage rows and reject extra fields such as prompts or raw message bodies. Reports include provider/model route identifiers, token counts, evidence gaps, prices and calculated cost, so operators should still choose non-sensitive route labels.

The offline CLI reads only the two files explicitly named by the caller. Treat raw session-event files as sensitive and run the CLI in an appropriately protected workspace.
