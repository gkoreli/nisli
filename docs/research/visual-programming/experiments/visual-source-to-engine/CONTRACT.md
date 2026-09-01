# Behavior contract supplied to the visual-first experiment

This is deliberately not a layout description.

## Screen

- Name: Import transactions.
- Empty state: choose one CSV file and one destination account.
- Populated state: map file columns, inspect parsing results, and import valid
  transactions.
- Required mapping meanings: date, payee, amount, and optional note.
- Required summaries: rows found, ready to import, and problems.
- Required preview meanings: date, payee, amount, and parsing status.
- The import action exists only when at least one transaction is ready. Its
  label includes the ready count.
- Problems tell the user to fix the mapping; zero problems confirms that all
  rows parsed.

## Locked behavior

- No navigation behavior is part of this screen contract.
- No reset-mapping action is declared.
- No pagination behavior is declared.
- Sections are not declared collapsible.
- File selection is required; drag-and-drop is not declared.
- The compiler may omit visual suggestions that require undeclared behavior.

## Observation request

Generate the empty and populated states at a wide desktop context and a narrow
touch context. They must look like one product, and the narrow result must
recompose rather than shrink the desktop.
