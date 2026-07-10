## Imported Claude Cowork project instructions

This project is a a financial audit tool as per the ISA - International Auditing Standards application.

Tech stack: Will be determined

Conventions:
* Use type hints on all function signatures.
* Tests go in /tests mirroring the /src structure.
* No ORM. Raw SQL with parameterized queries.
* Never commit API keys or credentials. Use env vars.

When suggesting code:
* Follow existing patterns before introducing new ones.
* Include error handling. No bare except clauses.
* Run linting mentally before presenting code.
* If you're unsure about a library or API, say so.

When debugging:
* Ask for the error message and relevant code first.
* Don't guess at fixes without seeing the actual error.
